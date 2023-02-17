'use strict';

export class SessionClosedError extends Error {
  constructor(message = 'session closed', ...params) {
    super(message, ...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SessionClosedError);
    }
    this.name = 'SessionClosedError';
  }
}

export class SessionEstablishedError extends Error {
  constructor(message = 'session is already established', ...params) {
    super(message, ...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SessionEstablishedError);
    }
    this.name = 'SessionEstablishedError';
  }
}

export class SessionNotEstablishedError extends Error {
  constructor(message = 'session not established yet', ...params) {
    super(message, ...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SessionNotEstablishedError);
    }
    this.name = 'SessionNotEstablishedError';
  }
}

export class ReadDeadlineExceededError extends Error {
  constructor(message = 'read deadline exceeded', ...params) {
    super(message, ...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReadDeadlineExceededError);
    }
    this.name = 'ReadDeadlineExceededError';
  }
}

export class WriteDeadlineExceededError extends Error {
  constructor(message = 'write deadline exceeded', ...params) {
    super(message, ...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WriteDeadlineExceededError);
    }
    this.name = 'WriteDeadlineExceededError';
  }
}

export class BufferSizeTooSmallError extends Error {
  constructor(message = 'read buffer size is less than data length in non-session mode', ...params) {
    super(message, ...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BufferSizeTooSmallError);
    }
    this.name = 'BufferSizeTooSmallError';
  }
}

export class DataSizeTooLargeError extends Error {
  constructor(message = 'data size is greater than session mtu in non-session mode', ...params) {
    super(message, ...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DataSizeTooLargeError);
    }
    this.name = 'DataSizeTooLargeError';
  }
}

export class InvalidPacketError extends Error {
  constructor(message = 'invalid packet', ...params) {
    super(message, ...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidPacketError);
    }
    this.name = 'InvalidPacketError';
  }
}

export class RecvWindowFullError extends Error {
  constructor(message = 'receive window full', ...params) {
    super(message, ...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RecvWindowFullError);
    }
    this.name = 'RecvWindowFullError';
  }
}

export class NotHandshakeError extends Error {
  constructor(message = 'first packet is not handshake packet', ...params) {
    super(message, ...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NotHandshakeError);
    }
    this.name = 'NotHandshakeError';
  }
}

export class DialTimeoutError extends Error {
  constructor(message = 'dial timeout', ...params) {
    super(message, ...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DialTimeoutError);
    }
    this.name = 'DialTimeoutError';
  }
}

export class ConnNotFoundError extends Error {
  constructor(message = 'Connection not found', ...params) {
    super(message, ...params);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConnNotFoundError);
    }
    this.name = 'ConnNotFoundError';
  }
}
