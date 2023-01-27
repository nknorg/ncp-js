'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _heap = _interopRequireDefault(require("heap"));

var _channel = _interopRequireDefault(require("./channel"));

var errors = _interopRequireWildcard(require("./errors"));

var _packet_pb = require("./pb/packet_pb");

var util = _interopRequireWildcard(require("./util"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class Connection {
  constructor(session, localClientID, remoteClientID, initialWindowSize) {
    _defineProperty(this, "session", void 0);

    _defineProperty(this, "localClientID", void 0);

    _defineProperty(this, "remoteClientID", void 0);

    _defineProperty(this, "windowSize", void 0);

    _defineProperty(this, "sendWindowUpdate", void 0);

    _defineProperty(this, "timeSentSeq", void 0);

    _defineProperty(this, "resentSeq", void 0);

    _defineProperty(this, "sendAckQueue", void 0);

    _defineProperty(this, "retransmissionTimeout", void 0);

    this.session = session;
    this.localClientID = localClientID;
    this.remoteClientID = remoteClientID;
    this.windowSize = initialWindowSize;
    this.retransmissionTimeout = session.config.initialRetransmissionTimeout;
    this.sendWindowUpdate = new _channel.default(1);
    this.timeSentSeq = new Map();
    this.resentSeq = new Map();
    this.sendAckQueue = new _heap.default();
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
      this.retransmissionTimeout += Math.tanh((3 * rtt - this.retransmissionTimeout) / 1000) * 100;

      if (this.retransmissionTimeout > this.session.config.maxRetransmissionTimeout) {
        this.retransmissionTimeout = this.session.config.maxRetransmissionTimeout;
      }
    }

    this.timeSentSeq.delete(sequenceID);
    this.resentSeq.delete(sequenceID);

    _channel.default.select([this.sendWindowUpdate.push(null), util.closedChan.shift()]);
  }

  async _waitForSendWindow(ctx) {
    while (this.sendWindowUsed() >= this.windowSize) {
      let timeout = util.timeoutChan(util._maxWait);

      switch (await _channel.default.select([this.sendWindowUpdate.shift(), timeout.shift(), ctx.done.shift()])) {
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

        switch (await _channel.default.select([this.session.resendChan.push(seq), this.session.context.done.shift()])) {
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

      switch (await _channel.default.select([timeout.shift(), this.session.context.done.shift()])) {
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
        let packet = new _packet_pb.Packet();
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

      switch (await _channel.default.select([timeout.shift(), this.session.context.done.shift()])) {
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
          switch (await _channel.default.select([this.session.resendChan.push(seq), this.session.context.done.shift()])) {
            case this.session.resendChan:
              this.resentSeq.set(seq, null);
              this.setWindowSize(this.windowSize / 2);
              newResend = true;
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

exports.default = Connection;