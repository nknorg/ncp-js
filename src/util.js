'use strict';

import Channel from './channel';

import * as consts from './consts';

export const maxUint32 = 0xffffffff;
export const _maxWait = 1000;
export const _errMaxWait = new Error('max wait time reached');
export const closedChan = new Channel();
closedChan.close();

export function nextSeq(seq, step) {
  let max = maxUint32 - consts.minSequenceID + 1;
  let res = (seq - consts.minSequenceID + step) % max;
  if (res < 0) {
    res += max;
  }
  return res + consts.minSequenceID;
}

export function seqInBetween(startSeq, endSeq, targetSeq) {
  if (startSeq <= endSeq) {
    return targetSeq >= startSeq && targetSeq < endSeq;
  }
  return targetSeq >= startSeq || targetSeq < endSeq;
};

export function compareSeq(seq1, seq2) {
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
};

export function connKey(localClientID, remoteClientID) {
  return localClientID + " - " + remoteClientID;
};

export function timeoutChan(timeout) {
  let chan = new Channel();
  setTimeout(chan.close, timeout);
  return chan;
};

export function sleep(duration) {
  return new Promise(resolve => setTimeout(resolve, duration));
}

export function mergeUint8Array(head, tail) {
  let merged = new Uint8Array(head.length + tail.length);
  merged.set(head);
  merged.set(tail, head.length);
  return merged;
};

export function promiseTimeout(promise, timeout, error) {
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
