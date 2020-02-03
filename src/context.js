'use strict';

import Channel from './channel';

export class ContextCanceledError extends Error {
  constructor(...params) {
    super(...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContextCanceledError);
    }
    this.name = 'ContextCanceledError';
    this.message = 'context canceled';
  }
}

export class ContextDeadlineExceededError extends Error {
  constructor(...params) {
    super(...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContextDeadlineExceededError);
    }
    this.name = 'ContextDeadlineExceededError';
    this.message = 'context deadline exceeded';
  }
}

export default class Context {
  done;
  err;
  cancelChan;
  timeoutTimer;

  constructor(parent = null, cancel = false, timeout = 0) {
    this.done = new Channel();
    this.err = null;

    let channels = [], parentChan, timeoutChan;

    if (parent) {
      parentChan = parent.done;
      channels.push(parentChan.shift());
    }

    if (cancel) {
      this.cancelChan = new Channel();
      channels.push(this.cancelChan.shift());
    }

    if (timeout > 0) {
      timeoutChan = new Channel();
      channels.push(timeoutChan.shift())
      this.timeoutTimer = setTimeout(timeoutChan.close, timeout);
    }

    if (channels.length > 0) {
      Channel.select(channels).then((selected) => {
        switch (selected) {
          case parentChan:
            return parent.err;
          case this.cancelChan:
            return new ContextCanceledError();
          case timeoutChan:
            return new ContextDeadlineExceededError();
        }
      }).then((err) => {
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
    } catch (e) {
    }
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
