'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.ContextDeadlineExceededError = exports.ContextCanceledError = void 0;

var _channel = _interopRequireDefault(require("./channel"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class ContextCanceledError extends Error {
  constructor(...params) {
    super(...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContextCanceledError);
    }

    this.name = 'ContextCanceledError';
    this.message = 'context canceled';
  }

}

exports.ContextCanceledError = ContextCanceledError;

class ContextDeadlineExceededError extends Error {
  constructor(...params) {
    super(...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContextDeadlineExceededError);
    }

    this.name = 'ContextDeadlineExceededError';
    this.message = 'context deadline exceeded';
  }

}

exports.ContextDeadlineExceededError = ContextDeadlineExceededError;

class Context {
  constructor(parent = null, cancel = false, timeout = 0) {
    _defineProperty(this, "done", void 0);

    _defineProperty(this, "err", void 0);

    _defineProperty(this, "cancelChan", void 0);

    _defineProperty(this, "timeoutTimer", void 0);

    this.done = new _channel.default();
    this.err = null;
    let channels = [],
        parentChan,
        timeoutChan;

    if (parent) {
      parentChan = parent.done;
      channels.push(parentChan.shift());
    }

    if (cancel) {
      this.cancelChan = new _channel.default();
      channels.push(this.cancelChan.shift());
    }

    if (timeout > 0) {
      timeoutChan = new _channel.default();
      channels.push(timeoutChan.shift());
      this.timeoutTimer = setTimeout(timeoutChan.close, timeout);
    }

    if (channels.length > 0) {
      _channel.default.select(channels).then(selected => {
        switch (selected) {
          case parentChan:
            return parent.err;

          case this.cancelChan:
            return new ContextCanceledError();

          case timeoutChan:
            return new ContextDeadlineExceededError();
        }
      }).then(err => {
        this.err = err;
        this.done.close();
        this.cancel();
        clearTimeout(this.timeoutTimer);
      });
    }
  }

  async cancel() {
    try {
      if (this.cancelChan) {
        await this.cancelChan.close();
      }
    } catch (e) {}
  }

  static background() {
    return new Context(null, false, 0);
  }

  static withCancel(parent) {
    return new Context(parent, true, 0);
  }

  static withTimeout(parent, timeout) {
    return new Context(parent, true, timeout);
  }

}

exports.default = Context;