'use strict';

import Heap from 'heap';
import Channel from './channel';

import * as errors from './errors';
import { Packet } from './pb/packet_pb';
import * as util from './util';

export default class Connection {
  session;
  localClientID;
  remoteClientID;
  windowSize;
  sendWindowUpdate;
  timeSentSeq;
  resentSeq;
  sendAckQueue
  retransmissionTimeout;

  constructor(session, localClientID, remoteClientID, initialWindowSize) {
    this.session = session;
    this.localClientID = localClientID;
    this.remoteClientID = remoteClientID;
    this.windowSize = initialWindowSize;
    this.retransmissionTimeout = session.config.initialRetransmissionTimeout;
    this.sendWindowUpdate = new Channel(1);
    this.timeSentSeq = new Map();
    this.resentSeq = new Map();
    this.sendAckQueue = new Heap();
  }

  sendWindowUsed() {
    return this.timeSentSeq.size;
  }

  sendAck(sequenceID) {
    this.sendAckQueue.push(sequenceID);
  }

  sendAckQueueLen() {
    return this.sendAckQueue.size();
  }

  receiveAck(sequenceID, isSentByMe) {
    if (!this.timeSentSeq.has(sequenceID)) {
      return;
    }

    if (!this.resentSeq.has(sequenceID)) {
      this.setWindowSize(this.windowSize + 1);
    }

    if (isSentByMe) {
      let rtt = Date.now() - this.timeSentSeq.get(sequenceID);
      this.retransmissionTimeout += Math.tanh((3*rtt - this.retransmissionTimeout) / 1000) * 100;
      if (this.retransmissionTimeout > this.session.config.maxRetransmissionTimeout) {
        this.retransmissionTimeout = this.session.config.maxRetransmissionTimeout
      }
    }

    this.timeSentSeq.delete(sequenceID);
    this.resentSeq.delete(sequenceID);

    Channel.select([this.sendWindowUpdate.push(null), util.closedChan.shift()]);
  }

  async _waitForSendWindow(ctx) {
    while (this.sendWindowUsed() >= this.windowSize) {
      let timeout = util.timeoutChan(util._maxWait);
      switch (await Channel.select([this.sendWindowUpdate.shift(), timeout.shift(), ctx.done.shift()])) {
        case this.sendWindowUpdate:
          break;
        case timeout:
          throw util._errMaxWait;
        case ctx.done:
          throw ctx.err;
      }
    }
  }

  start() {
    this._tx().catch(() => {});
    this._sendAck().catch(() => {});
    this._checkTimeout().catch(() => {});
  }

  async _tx() {
    let seq = 0;
    while (true) {
      if (seq === 0) {
        seq = await this.session._getResendSeq();
      }

      if (seq === 0) {
        try {
          await this._waitForSendWindow(this.session.context);
        } catch (e) {
          if (e === util._errMaxWait) {
            continue;
          }
          throw e;
        }

        seq = await this.session._getSendSeq();
      }

      let buf = this.session.getDataToSend(seq);
      if (!buf) {
        this.timeSentSeq.delete(seq);
        this.resentSeq.delete(seq);
        seq = 0;
        continue;
      }

      try {
        await this.session.sendWith(this.localClientID, this.remoteClientID, buf);
      } catch (e) {
        if (this.session.isClosed) {
          throw new errors.SessionClosedError();
        }
        console.log(e);

        this.setWindowSize(this.windowSize / 2);
        this.session.updateConnWindowSize();
      
        switch (await Channel.select([this.session.resendChan.push(seq), this.session.context.done.shift()])) {
          case this.session.resendChan:
            seq = 0;
            break;
          case this.session.context.done:
            throw this.session.context.err;
        }
        await util.sleep(1000);
        continue;
      }

      if (!this.timeSentSeq.has(seq)) {
        this.timeSentSeq.set(seq, Date.now());
      }
      this.resentSeq.delete(seq);

      seq = 0;
    }
  }

  async _sendAck() {
    while (true) {
      let timeout = util.timeoutChan(this.session.config.sendAckInterval);
      switch (await Channel.select([timeout.shift(), this.session.context.done.shift()])) {
        case timeout:
          break;
        case this.session.context.done:
          throw this.session.context.err;
      }

      if (this.sendAckQueueLen() === 0) {
        continue;
      }

      let ackStartSeqList = [];
      let ackSeqCountList = [];

      while (this.sendAckQueueLen() > 0 && ackStartSeqList.length < this.session.config.maxAckSeqListSize) {
        let ackStartSeq = this.sendAckQueue.pop();
        let ackSeqCount = 1;
        while (this.sendAckQueueLen() > 0 && this.sendAckQueue.peek() === util.nextSeq(ackStartSeq, ackSeqCount)) {
          this.sendAckQueue.pop();
          ackSeqCount++;
        }

        ackStartSeqList.push(ackStartSeq);
        ackSeqCountList.push(ackSeqCount);
      }

      let omitCount = true;
      for (let c of ackSeqCountList) {
        if (c != 1) {
          omitCount = false;
          break;
        }
      }
      if (omitCount) {
        ackSeqCountList = null;
      }

      try {
        let packet = new Packet();
        packet.setAckStartSeqList(ackStartSeqList);
        if (ackSeqCountList) {
          packet.setAckSeqCountList(ackSeqCountList);
        }
        packet.setBytesRead(this.session.bytesRead);
        let buf = packet.serializeBinary();
        await this.session.sendWith(this.localClientID, this.remoteClientID, buf);
        this.session.bytesReadSentTime = Date.now();
      } catch (e) {
        console.log(e);
        await util.sleep(1000);
        continue;
      }
    }
  }

  async _checkTimeout() {
    while (true) {
      let timeout = util.timeoutChan(this.session.config.checkTimeoutInterval);
      switch (await Channel.select([timeout.shift(), this.session.context.done.shift()])) {
        case timeout:
          break;
        case this.session.context.done:
          throw this.session.context.err;
      }

      let threshold = Date.now() - this.retransmissionTimeout;
      let newResend = false;
      for (let [seq, t] of this.timeSentSeq) {
        if (this.resentSeq.has(seq)) {
          continue;
        }
        if (t < threshold) {
          switch (await Channel.select([this.session.resendChan.push(seq), this.session.context.done.shift()])) {
            case this.session.resendChan:
              this.resentSeq.set(seq, null);
              this.setWindowSize(this.windowSize / 2);
              newResend = true
              break;
            case this.session.context.done:
              throw this.session.context.err;
          }
        }
      }
      if (newResend) {
        this.session.updateConnWindowSize();
      }
    }
  }

  setWindowSize(n) {
    if (n < this.session.config.MinConnectionWindowSize) {
      n = this.session.config.MinConnectionWindowSize;
    }
    this.windowSize = n;
  }
}
