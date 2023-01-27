'use strict';

export const defaultConfig = {
  nonStream:                    false,
  sessionWindowSize:            4 << 20,
  mtu:                          1024,
  minConnectionWindowSize:      1,
  maxAckSeqListSize:            32,
  flushInterval:                10,
  linger:                       1000,
  initialRetransmissionTimeout: 5000,
  maxRetransmissionTimeout:     10000,
  sendAckInterval:              50,
  checkTimeoutInterval:         50,
  checkBytesReadInterval:       100,
  sendBytesReadThreshold:       200,
};

export const minSequenceID = 1;
