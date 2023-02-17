'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WriteDeadlineExceededError = exports.SessionNotEstablishedError = exports.SessionEstablishedError = exports.SessionClosedError = exports.RecvWindowFullError = exports.ReadDeadlineExceededError = exports.NotHandshakeError = exports.InvalidPacketError = exports.DialTimeoutError = exports.DataSizeTooLargeError = exports.ConnNotFoundError = exports.BufferSizeTooSmallError = void 0;

class SessionClosedError extends Error {
  constructor(message = 'session closed', ...params) {
    super(message, ...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SessionClosedError);
    }

    this.name = 'SessionClosedError';
  }

}

exports.SessionClosedError = SessionClosedError;

class SessionEstablishedError extends Error {
  constructor(message = 'session is already established', ...params) {
    super(message, ...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SessionEstablishedError);
    }

    this.name = 'SessionEstablishedError';
  }

}

exports.SessionEstablishedError = SessionEstablishedError;

class SessionNotEstablishedError extends Error {
  constructor(message = 'session not established yet', ...params) {
    super(message, ...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SessionNotEstablishedError);
    }

    this.name = 'SessionNotEstablishedError';
  }

}

exports.SessionNotEstablishedError = SessionNotEstablishedError;

class ReadDeadlineExceededError extends Error {
  constructor(message = 'read deadline exceeded', ...params) {
    super(message, ...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReadDeadlineExceededError);
    }

    this.name = 'ReadDeadlineExceededError';
  }

}

exports.ReadDeadlineExceededError = ReadDeadlineExceededError;

class WriteDeadlineExceededError extends Error {
  constructor(message = 'write deadline exceeded', ...params) {
    super(message, ...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WriteDeadlineExceededError);
    }

    this.name = 'WriteDeadlineExceededError';
  }

}

exports.WriteDeadlineExceededError = WriteDeadlineExceededError;

class BufferSizeTooSmallError extends Error {
  constructor(message = 'read buffer size is less than data length in non-session mode', ...params) {
    super(message, ...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BufferSizeTooSmallError);
    }

    this.name = 'BufferSizeTooSmallError';
  }

}

exports.BufferSizeTooSmallError = BufferSizeTooSmallError;

class DataSizeTooLargeError extends Error {
  constructor(message = 'data size is greater than session mtu in non-session mode', ...params) {
    super(message, ...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DataSizeTooLargeError);
    }

    this.name = 'DataSizeTooLargeError';
  }

}

exports.DataSizeTooLargeError = DataSizeTooLargeError;

class InvalidPacketError extends Error {
  constructor(message = 'invalid packet', ...params) {
    super(message, ...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidPacketError);
    }

    this.name = 'InvalidPacketError';
  }

}

exports.InvalidPacketError = InvalidPacketError;

class RecvWindowFullError extends Error {
  constructor(message = 'receive window full', ...params) {
    super(message, ...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RecvWindowFullError);
    }

    this.name = 'RecvWindowFullError';
  }

}

exports.RecvWindowFullError = RecvWindowFullError;

class NotHandshakeError extends Error {
  constructor(message = 'first packet is not handshake packet', ...params) {
    super(message, ...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NotHandshakeError);
    }

    this.name = 'NotHandshakeError';
  }

}

exports.NotHandshakeError = NotHandshakeError;

class DialTimeoutError extends Error {
  constructor(message = 'dial timeout', ...params) {
    super(message, ...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DialTimeoutError);
    }

    this.name = 'DialTimeoutError';
  }

}

exports.DialTimeoutError = DialTimeoutError;

class ConnNotFoundError extends Error {
  constructor(message = 'Connection not found', ...params) {
    super(message, ...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConnNotFoundError);
    }

    this.name = 'ConnNotFoundError';
  }

}

exports.ConnNotFoundError = ConnNotFoundError;