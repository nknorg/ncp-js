'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _promise = _interopRequireDefault(require("core-js-pure/features/promise"));

var _channel = _interopRequireDefault(require("./channel"));

var _connection = _interopRequireDefault(require("./connection"));

var consts = _interopRequireWildcard(require("./consts"));

var context = _interopRequireWildcard(require("./context"));

var errors = _interopRequireWildcard(require("./errors"));

var _packet_pb = require("./pb/packet_pb");

var util = _interopRequireWildcard(require("./util"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class Session {
  constructor(localAddr, remoteAddr, localClientIDs, remoteClientIDs, sendWith, config = {}) {
    _defineProperty(this, "config", void 0);

    _defineProperty(this, "localAddr", void 0);

    _defineProperty(this, "remoteAddr", void 0);

    _defineProperty(this, "localClientIDs", void 0);

    _defineProperty(this, "remoteClientIDs", void 0);

    _defineProperty(this, "sendWith", void 0);

    _defineProperty(this, "sendWindowSize", void 0);

    _defineProperty(this, "recvWindowSize", void 0);

    _defineProperty(this, "sendMtu", void 0);

    _defineProperty(this, "recvMtu", void 0);

    _defineProperty(this, "connections", void 0);

    _defineProperty(this, "onAccept", void 0);

    _defineProperty(this, "sendChan", void 0);

    _defineProperty(this, "resendChan", void 0);

    _defineProperty(this, "sendWindowUpdate", void 0);

    _defineProperty(this, "recvDataUpdate", void 0);

    _defineProperty(this, "context", void 0);

    _defineProperty(this, "readContext", void 0);

    _defineProperty(this, "writeContext", void 0);

    _defineProperty(this, "isAccepted", void 0);

    _defineProperty(this, "isEstablished", void 0);

    _defineProperty(this, "isClosed", void 0);

    _defineProperty(this, "sendBuffer", void 0);

    _defineProperty(this, "sendWindowStartSeq", void 0);

    _defineProperty(this, "sendWindowEndSeq", void 0);

    _defineProperty(this, "sendWindowData", void 0);

    _defineProperty(this, "recvWindowStartSeq", void 0);

    _defineProperty(this, "recvWindowUsed", void 0);

    _defineProperty(this, "recvWindowData", void 0);

    _defineProperty(this, "bytesWrite", void 0);

    _defineProperty(this, "bytesRead", void 0);

    _defineProperty(this, "bytesReadSentTime", void 0);

    _defineProperty(this, "bytesReadUpdateTime", void 0);

    _defineProperty(this, "remoteBytesRead", void 0);

    _defineProperty(this, "ReadableStream", void 0);

    _defineProperty(this, "_readableStream", void 0);

    _defineProperty(this, "WritableStream", void 0);

    _defineProperty(this, "_writableStream", void 0);

    _defineProperty(this, "sendWindowPacketCount", void 0);

    this.config = Object.assign({}, consts.defaultConfig, config);
    this.localAddr = localAddr;
    this.remoteAddr = remoteAddr;
    this.localClientIDs = localClientIDs;
    this.remoteClientIDs = remoteClientIDs;
    this.sendWith = sendWith;
    this.sendWindowSize = this.config.sessionWindowSize;
    this.recvWindowSize = this.config.sessionWindowSize;
    this.sendMtu = this.config.mtu;
    this.recvMtu = this.config.mtu;
    this.sendWindowStartSeq = consts.minSequenceID;
    this.sendWindowEndSeq = consts.minSequenceID;
    this.recvWindowStartSeq = consts.minSequenceID;
    this.recvWindowUsed = 0;
    this.bytesWrite = 0;
    this.bytesRead = 0;
    this.bytesReadSentTime = Date.now();
    this.bytesReadUpdateTime = Date.now();
    this.remoteBytesRead = 0;
    this.onAccept = new _channel.default(1);
    this.context = context.default.withCancel();
    this.setTimeout(0);
    this.ReadableStream = null;
    this._readableStream = null;
    this.WritableStream = null;
    this._writableStream = null;
    this.sendWindowPacketCount = this.sendWindowSize / this.sendMtu;
  }

  isStream() {
    return !this.config.nonStream;
  }

  sendWindowUsed() {
    if (this.bytesWrite > this.remoteBytesRead) {
      return this.bytesWrite - this.remoteBytesRead;
    }

    return 0;
  }

  getDataToSend(sequenceID) {
    return this.sendWindowData.get(sequenceID);
  }

  getConnWindowSize() {
    let windowSize = 0;

    for (let connection of this.connections.values()) {
      windowSize += connection.windowSize;
    }

    return windowSize;
  }

  async _getResendSeq() {
    let value = await _channel.default.selectValue([this.resendChan.shift(), this.context.done.shift(), util.closedChan.shift()]);

    if (value === undefined) {
      if (this.context.err) {
        throw this.context.err;
      }

      return 0;
    }

    return value;
  }

  async _getSendSeq() {
    let value = await _channel.default.selectValue([this.resendChan.shift(), this.sendChan.shift(), this.context.done.shift()]);

    if (value === undefined) {
      throw this.context.err;
    }

    return value;
  }

  receiveWith(localClientID, remoteClientID, buf) {
    if (this.isClosed) {
      throw new errors.SessionClosedError();
    }

    let packet = _packet_pb.Packet.deserializeBinary(buf);

    if (packet.getClose()) {
      return this._handleClosePacket();
    }

    let isEstablished = this.isEstablished;

    if (!isEstablished && packet.getHandshake()) {
      return this._handleHandshakePacket(packet);
    }

    if (isEstablished && (packet.getAckStartSeqList().length > 0 || packet.getAckSeqCountList().length > 0)) {
      if (packet.getAckStartSeqList().length > 0 && packet.getAckSeqCountList().length > 0 && packet.getAckStartSeqList().length !== packet.getAckSeqCountList().length) {
        throw new errors.InvalidPacketError('AckStartSeq and AckSeqCount should have the same length if both are non-empty');
      }

      let count = 0;

      if (packet.getAckStartSeqList().length > 0) {
        count = packet.getAckStartSeqList().length;
      } else {
        count = packet.getAckSeqCountList().length;
      }

      let ackStartSeq = 0,
          ackEndSeq = 0;

      for (let i = 0; i < count; i++) {
        if (packet.getAckStartSeqList().length > 0) {
          ackStartSeq = packet.getAckStartSeqList()[i];
        } else {
          ackStartSeq = consts.minSequenceID;
        }

        if (packet.getAckSeqCountList().length > 0) {
          ackEndSeq = util.nextSeq(ackStartSeq, packet.getAckSeqCountList()[i]);
        } else {
          ackEndSeq = util.nextSeq(ackStartSeq, 1);
        }

        if (util.seqInBetween(this.sendWindowStartSeq, this.sendWindowEndSeq, util.nextSeq(ackEndSeq, -1))) {
          if (!util.seqInBetween(this.sendWindowStartSeq, this.sendWindowEndSeq, ackStartSeq)) {
            ackStartSeq = this.sendWindowStartSeq;
          }

          for (let seq = ackStartSeq; util.seqInBetween(ackStartSeq, ackEndSeq, seq); seq = util.nextSeq(seq, 1)) {
            for (let [key, connection] of this.connections) {
              connection.receiveAck(seq, key === util.connKey(localClientID, remoteClientID));
            }

            this.sendWindowData.delete(seq);
          }

          if (ackStartSeq === this.sendWindowStartSeq) {
            while (true) {
              this.sendWindowStartSeq = util.nextSeq(this.sendWindowStartSeq, 1);

              if (this.sendWindowData.has(this.sendWindowStartSeq)) {
                break;
              }

              if (this.sendWindowStartSeq === this.sendWindowEndSeq) {
                break;
              }
            }
          }
        }
      }

      this.updateConnWindowSize();
    }

    if (isEstablished && packet.getBytesRead() > this.remoteBytesRead) {
      this.remoteBytesRead = packet.getBytesRead();

      _channel.default.select([this.sendWindowUpdate.push(null), util.closedChan.shift()]);
    }

    if (isEstablished && packet.getSequenceId() > 0) {
      if (packet.getData().length > this.recvMtu) {
        throw new errors.DataSizeTooLargeError();
      }

      if (util.compareSeq(packet.getSequenceId(), this.recvWindowStartSeq) >= 0) {
        if (!this.recvWindowData.has(packet.getSequenceId())) {
          if (this.recvWindowUsed + packet.getData().length > this.recvWindowSize) {
            throw new errors.RecvWindowFullError();
          }

          this.recvWindowData.set(packet.getSequenceId(), packet.getData());
          this.recvWindowUsed += packet.getData().length;

          if (packet.getSequenceId() === this.recvWindowStartSeq) {
            _channel.default.select([this.recvDataUpdate.push(null), util.closedChan.shift()]);
          }
        }
      }

      let conn = this.connections.get(util.connKey(localClientID, remoteClientID));

      if (conn) {
        conn.sendAck(packet.getSequenceId());
      } else {
        throw new errors.ConnNotFoundError('Connection ' + util.connKey(localClientID, remoteClientID) + ' not found.');
      }
    }
  }

  _start() {
    this._startFlush().catch(() => {});

    this._startCheckBytesRead().catch(() => {});

    for (let connection of this.connections.values()) {
      connection.start();
    }
  }

  async _startFlush() {
    while (true) {
      let timeout = util.timeoutChan(this.config.flushInterval);

      switch (await _channel.default.select([timeout.shift(), this.context.done.shift()])) {
        case timeout:
          break;

        case this.context.done:
          throw this.context.err;
      }

      if (!this.sendBuffer || this.sendBuffer.length === 0) {
        continue;
      }

      try {
        await this._flushSendBuffer();
      } catch (e) {
        if (this.context.err) {
          throw e;
        }

        console.log(e);
        continue;
      }
    }
  }

  async _startCheckBytesRead() {
    while (true) {
      let timeout = util.timeoutChan(this.config.checkBytesReadInterval);

      switch (await _channel.default.select([timeout.shift(), this.context.done.shift()])) {
        case timeout:
          break;

        case this.context.done:
          throw this.context.err;
      }

      if (this.bytesRead === 0 || this.bytesReadSentTime > this.bytesReadUpdateTime || Date.now() - this.bytesReadUpdateTime < this.config.sendBytesReadThreshold) {
        continue;
      }

      try {
        let packet = new _packet_pb.Packet();
        packet.setBytesRead(this.bytesRead);
        let buf = packet.serializeBinary();
        let promises = [];

        for (let connection of this.connections.values()) {
          promises.push(this.sendWith(connection.localClientID, connection.remoteClientID, buf));
        }

        await _promise.default.any(promises);
        this.bytesReadSentTime = Date.now();
      } catch (e) {
        console.log(e.errors);
        await util.sleep(1000);
        continue;
      }
    }
  }

  async _waitForSendWindow(ctx, n) {
    while (this.sendWindowUsed() + n > this.sendWindowSize) {
      let timeout = util.timeoutChan(util._maxWait);

      switch (await _channel.default.select([this.sendWindowUpdate.shift(), timeout.shift(), ctx.done.shift()])) {
        case this.sendWindowUpdate:
          break;

        case timeout:
          break;

        case ctx.done:
          throw ctx.err;
      }
    }

    return this.sendWindowSize - this.sendWindowUsed();
  }

  async _flushSendBuffer() {
    if (!this.sendBuffer || this.sendBuffer.length === 0) {
      return;
    }

    let seq = this.sendWindowEndSeq;
    let packet = new _packet_pb.Packet();
    packet.setSequenceId(seq);
    packet.setData(this.sendBuffer);
    let buf = packet.serializeBinary();
    this.sendWindowData.set(seq, buf);
    this.sendWindowEndSeq = util.nextSeq(seq, 1);
    this.sendBuffer = new Uint8Array(0);

    switch (await _channel.default.select([this.sendChan.push(seq), this.context.done.shift()])) {
      case this.sendChan:
        break;

      case this.context.done:
        throw this.context.err;
    }
  }

  async _sendHandshakePacket(writeTimeout) {
    let packet = new _packet_pb.Packet();
    packet.setHandshake(true);
    packet.setClientIdsList(this.localClientIDs);
    packet.setWindowSize(this.recvWindowSize);
    packet.setMtu(this.recvMtu);
    let buf = packet.serializeBinary();
    let promises = [];

    if (this.connections && this.connections.size > 0) {
      for (let connection of this.connections.values()) {
        promises.push(util.promiseTimeout(this.sendWith(connection.localClientID, connection.remoteClientID, buf), writeTimeout, new errors.WriteDeadlineExceededError()));
      }
    } else {
      promises = this.localClientIDs.map((localClientID, i) => {
        let remoteClientID = localClientID;

        if (this.remoteClientIDs && this.remoteClientIDs.length > 0) {
          remoteClientID = this.remoteClientIDs[i % this.remoteClientIDs.length];
        }

        return util.promiseTimeout(this.sendWith(localClientID, remoteClientID, buf), writeTimeout, new errors.WriteDeadlineExceededError());
      });
    }

    try {
      await _promise.default.any(promises);
    } catch (e) {
      throw e.errors;
    }
  }

  _handleHandshakePacket(packet) {
    if (this.isEstablished) {
      return;
    }

    if (packet.getWindowSize() === 0) {
      throw new errors.InvalidPacketError('WindowSize is zero');
    }

    if (packet.getWindowSize() < this.sendWindowSize) {
      this.sendWindowSize = packet.getWindowSize();
    }

    if (packet.getMtu() === 0) {
      throw new errors.InvalidPacketError('MTU is zero');
    }

    if (packet.getMtu() < this.sendMtu) {
      this.sendMtu = packet.getMtu();
    }

    this.sendWindowPacketCount = this.sendWindowSize / this.sendMtu;

    if (packet.getClientIdsList().length === 0) {
      throw new errors.InvalidPacketError('ClientIDs is empty');
    }

    let n = this.localClientIDs.length;

    if (packet.getClientIdsList().length < n) {
      n = packet.getClientIdsList().length;
    }

    let initialWindowSize = this.sendWindowPacketCount / n;
    let connections = new Map();

    for (let i = 0; i < n; i++) {
      let conn = new _connection.default(this, this.localClientIDs[i], packet.getClientIdsList()[i], initialWindowSize);
      connections.set(util.connKey(conn.localClientID, conn.remoteClientID), conn);
    }

    this.connections = connections;
    this.remoteClientIDs = packet.getClientIdsList();
    this.sendChan = new _channel.default();
    this.resendChan = new _channel.default(this.sendWindowPacketCount + n);
    this.sendWindowUpdate = new _channel.default(1);
    this.recvDataUpdate = new _channel.default(1);
    this.sendBuffer = new Uint8Array(0);
    this.sendWindowData = new Map();
    this.recvWindowData = new Map();
    this.isEstablished = true;

    _channel.default.select([this.onAccept.push(null), util.closedChan.shift()]);
  }

  async _sendClosePacket() {
    if (!this.isEstablished) {
      throw new errors.SessionNotEstablishedError();
    }

    let packet = new _packet_pb.Packet();
    packet.setClose(true);
    let buf = packet.serializeBinary();
    let promises = [];

    for (let connection of this.connections.values()) {
      promises.push(util.promiseTimeout(this.sendWith(connection.localClientID, connection.remoteClientID, buf), connection.retransmissionTimeout, new errors.WriteDeadlineExceededError()));
    }

    try {
      await _promise.default.any(promises);
    } catch (e) {
      throw e.errors;
    }
  }

  _handleClosePacket() {
    this.readContext.cancel();
    this.writeContext.cancel();
    this.context.cancel();
    this.isClosed = true;
  }

  async dial(dialTimeout) {
    if (this.isAccepted) {
      throw new errors.SessionEstablishedError();
    }

    await this._sendHandshakePacket(dialTimeout);
    let channels = [this.onAccept.shift()];
    let timeout;

    if (dialTimeout > 0) {
      timeout = util.timeoutChan(dialTimeout);
      channels.push(timeout.shift());
    }

    switch (await _channel.default.select(channels)) {
      case this.onAccept:
        break;

      case timeout:
        throw new errors.DialTimeoutError();
    }

    this._start();

    this.isAccepted = true;
  }

  async accept() {
    if (this.isAccepted) {
      throw new errors.SessionEstablishedError();
    }

    switch (await _channel.default.select([this.onAccept.shift(), util.closedChan.shift()])) {
      case this.onAccept:
        break;

      default:
        throw new errors.NotHandshakeError();
    }

    this._start();

    this.isAccepted = true;
    await this._sendHandshakePacket(this.config.maxRetransmissionTimeout);
  }

  async read(maxSize = 0) {
    try {
      if (this.isClosed) {
        throw new errors.SessionClosedError();
      }

      if (!this.isEstablished) {
        throw new errors.SessionNotEstablishedError();
      }

      while (true) {
        if (this.readContext.err) {
          throw this.readContext.err;
        }

        if (this.recvWindowData.has(this.recvWindowStartSeq)) {
          break;
        }

        let timeout = util.timeoutChan(util._maxWait);

        switch (await _channel.default.select([this.recvDataUpdate.shift(), timeout.shift(), this.readContext.done.shift()])) {
          case this.recvDataUpdate:
            break;

          case timeout:
            break;

          case this.readContext.done:
            throw this.readContext.err;
        }
      }

      let data = this.recvWindowData.get(this.recvWindowStartSeq);

      if (!this.isStream() && maxSize > 0 && maxSize < data.length) {
        throw new errors.BufferSizeTooSmallError();
      }

      let b = data;
      let bytesReceived = data.length;

      if (maxSize > 0) {
        b = new Uint8Array(maxSize);
        let subarray = data.subarray(0, maxSize);
        b.set(subarray);
        bytesReceived = subarray.length;
      }

      if (bytesReceived === data.length) {
        this.recvWindowData.delete(this.recvWindowStartSeq);
        this.recvWindowStartSeq = util.nextSeq(this.recvWindowStartSeq, 1);
      } else {
        this.recvWindowData.set(this.recvWindowStartSeq, data.subarray(bytesReceived));
      }

      this.recvWindowUsed -= bytesReceived;
      this.bytesRead += bytesReceived;
      this.bytesReadUpdateTime = Date.now();

      if (this.isStream()) {
        while (maxSize < 0 || bytesReceived < maxSize) {
          data = this.recvWindowData.get(this.recvWindowStartSeq);

          if (!data) {
            break;
          }

          let n;

          if (maxSize > 0) {
            let subarray = data.subarray(0, maxSize - bytesReceived);
            b.set(subarray, bytesReceived);
            n = subarray.length;
          } else {
            b = util.mergeUint8Array(b, data);
            n = data.length;
          }

          if (n === data.length) {
            this.recvWindowData.delete(this.recvWindowStartSeq);
            this.recvWindowStartSeq = util.nextSeq(this.recvWindowStartSeq, 1);
          } else {
            this.recvWindowData.set(this.recvWindowStartSeq, data.subarray(n));
          }

          this.recvWindowUsed -= n;
          this.bytesRead += n;
          this.bytesReadUpdateTime = Date.now();
          bytesReceived += n;
        }
      }

      return b.subarray(0, bytesReceived);
    } catch (e) {
      if (e instanceof context.ContextDeadlineExceededError) {
        throw new errors.ReadDeadlineExceededError();
      }

      if (e instanceof context.ContextCanceledError) {
        throw new errors.SessionClosedError();
      }

      throw e;
    }
  }

  async write(b) {
    try {
      if (this.isClosed) {
        throw new errors.SessionClosedError();
      }

      if (!this.isEstablished) {
        throw new errors.SessionNotEstablishedError();
      }

      if (!this.isStream() && (b.length > this.sendMtu || b > this.sendWindowSize)) {
        throw new errors.DataSizeTooLargeError();
      }

      if (b.length === 0) {
        return;
      }

      let bytesSent = 0;

      if (this.isStream()) {
        while (b.length > 0) {
          let sendWindowAvailable = await this._waitForSendWindow(this.writeContext, 1);
          let n = b.length;

          if (n > sendWindowAvailable) {
            n = sendWindowAvailable;
          }

          let shouldFlush = sendWindowAvailable === this.sendWindowSize;
          let c = this.sendMtu;
          let l = this.sendBuffer.length;

          if (n >= c - l) {
            n = c - l;
            shouldFlush = true;
          }

          this.sendBuffer = util.mergeUint8Array(this.sendBuffer, b.subarray(0, n));
          this.bytesWrite += n;
          bytesSent += n;

          if (shouldFlush) {
            await this._flushSendBuffer();
          }

          b = b.subarray(n);
        }
      } else {
        await this._waitForSendWindow(this.writeContext, b.length);
        this.sendBuffer = new Uint8Array(b);
        this.bytesWrite += b.length;
        bytesSent += b.length;
        await this._flushSendBuffer();
      }
    } catch (e) {
      if (e instanceof context.ContextDeadlineExceededError) {
        throw new errors.WriteDeadlineExceededError();
      }

      if (e instanceof context.ContextCanceledError) {
        throw new errors.SessionClosedError();
      }

      throw e;
    }
  }

  async close() {
    this.readContext.cancel();
    this.writeContext.cancel();
    let timeout = new _channel.default();

    if (this.config.linger > 0) {
      setTimeout(timeout.close, this.config.linger);
    }

    if (this.config.linger !== 0) {
      try {
        await this._flushSendBuffer();
      } catch (e) {
        console.log(e);
      }

      await (async () => {
        while (true) {
          let interval = util.timeoutChan(100);

          switch (await _channel.default.select([interval.shift(), timeout.shift()])) {
            case interval:
              if (this.sendWindowStartSeq === this.sendWindowEndSeq) {
                return;
              }

              break;

            case timeout:
              return;
          }
        }
      })();
    }

    try {
      await this._sendClosePacket();
    } catch (e) {
      console.log(e);
    }

    this.context.cancel();
    this.isClosed = true;
  }

  setTimeout(timeout) {
    this.setReadTimeout(timeout);
    this.setWriteTimeout(timeout);
  }

  setReadTimeout(timeout) {
    this.readContext = context.default.withTimeout(this.context, timeout);
  }

  setWriteTimeout(timeout) {
    this.writeContext = context.default.withTimeout(this.context, timeout);
  }

  setLinger(t) {
    this.config.linger = t;
  }

  getReadableStream() {
    if (!this._readableStream) {
      let _ReadableStream = this.ReadableStream || ReadableStream;

      this._readableStream = new _ReadableStream({
        start: controller => {
          this.context.done.shift().then(() => controller.close());
        },
        pull: controller => {
          if (this.isClosed) {
            return controller.close();
          }

          return this.read().then(data => controller.enqueue(data));
        }
      });
    }

    return this._readableStream;
  }

  getWritableStream(closeSessionOnEnd = false) {
    if (!this._writableStream) {
      let _WritableStream = this.WritableStream || WritableStream;

      let sink = {
        write: (data, controller) => {
          if (this.isClosed) {
            return controller.error(new errors.SessionClosedError());
          }

          return this.write(data);
        }
      };

      if (closeSessionOnEnd) {
        sink.close = controller => {
          return this.close();
        };

        sink.abort = reason => {
          console.log('Abort stream:', reason);
          this.setLinger(0);
          return this.close();
        };
      }

      this._writableStream = new _WritableStream(sink);
    }

    return this._writableStream;
  }

  updateConnWindowSize() {
    let totalSize = 0.0;

    for (let conn of this.connections.values()) {
      totalSize += conn.windowSize;
    }

    if (totalSize <= 0) {
      return;
    }

    for (let conn of this.connections.values()) {
      let n = this.sendWindowPacketCount * (conn.windowSize / totalSize);
      conn.setWindowSize(n);
    }
  }

}

exports.default = Session;