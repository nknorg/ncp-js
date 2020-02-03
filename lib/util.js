'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.nextSeq = nextSeq;
exports.seqInBetween = seqInBetween;
exports.compareSeq = compareSeq;
exports.connKey = connKey;
exports.timeoutChan = timeoutChan;
exports.sleep = sleep;
exports.mergeUint8Array = mergeUint8Array;
exports.promiseTimeout = promiseTimeout;
exports.closedChan = exports._errMaxWait = exports._maxWait = exports.maxUint32 = void 0;

var _channel = _interopRequireDefault(require("./channel"));

var consts = _interopRequireWildcard(require("./consts"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const maxUint32 = 0xffffffff;
exports.maxUint32 = maxUint32;
const _maxWait = 1000;
exports._maxWait = _maxWait;

const _errMaxWait = new Error('max wait time reached');

exports._errMaxWait = _errMaxWait;
const closedChan = new _channel.default();
exports.closedChan = closedChan;
closedChan.close();

function nextSeq(seq, step) {
  let max = maxUint32 - consts.minSequenceID + 1;
  let res = (seq - consts.minSequenceID + step) % max;

  if (res < 0) {
    res += max;
  }

  return res + consts.minSequenceID;
}

function seqInBetween(startSeq, endSeq, targetSeq) {
  if (startSeq <= endSeq) {
    return targetSeq >= startSeq && targetSeq < endSeq;
  }

  return targetSeq >= startSeq || targetSeq < endSeq;
}

;

function compareSeq(seq1, seq2) {
  if (seq1 === seq2) {
    return 0;
  }

  if (seq1 < seq2) {
    if (seq2 - seq1 < maxUint32 / 2) {
      return -1;
    }

    return 1;
  }

  if (seq1 - seq2 < maxUint32 / 2) {
    return 1;
  }

  return -1;
}

;

function connKey(localClientID, remoteClientID) {
  return localClientID + " - " + remoteClientID;
}

;

function timeoutChan(timeout) {
  let chan = new _channel.default();
  setTimeout(chan.close, timeout);
  return chan;
}

;

function sleep(duration) {
  return new Promise(resolve => setTimeout(resolve, duration));
}

function mergeUint8Array(head, tail) {
  let merged = new Uint8Array(head.length + tail.length);
  merged.set(head);
  merged.set(tail, head.length);
  return merged;
}

;

function promiseTimeout(promise, timeout, error) {
  return new Promise((resolve, reject) => {
    let timer;

    if (timeout > 0) {
      timer = setTimeout(() => reject(error), timeout);
    }

    promise.then(() => {
      clearTimeout(timer);
      resolve();
    }).catch(reject);
  });
}