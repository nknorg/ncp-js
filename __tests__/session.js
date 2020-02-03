'use strict';

const ncp = require('../lib');

class SessionTest {
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }

  mockReceive(receiver, receiverClientID, senderClientID, buf) {
    if (Math.random() > this.config.loss) {
      setTimeout(() => {
        try {
          receiver.receiveWith(receiverClientID, senderClientID, buf);
        } catch (e) {
          if (!(e instanceof ncp.errors.SessionClosedError)) {
            throw e;
          }
        }
      }, this.config.minLatency + Math.random()*(this.config.maxLatency - this.config.minLatency));
    }
  }

  byteAt(n) {
    return n % 256;
  }

  async dial(session) {
    await session.dial();
    console.log(session.localAddr, 'dialed a session');
  }

  async accept(session) {
    await ncp.util.sleep(2 * this.config.maxLatency + 100);
    session.accept();
    console.log(session.localAddr, 'accepted a sesison');
  }

  async read(session) {
    let timeStart = Date.now();
    let buf = new Uint8Array(0);
    while (buf.length < 4) {
      buf = ncp.util.mergeUint8Array(buf, await session.read(4 - buf.length));
    }
    let dv = new DataView(buf.buffer);
    let numBytes = dv.getUint32(0, true);
    for (let n = 0; n < numBytes; n += buf.length) {
      buf = await session.read();
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] !== this.byteAt(n + i)) {
          throw 'wrong value at byte ' + (n + i);
        }
      }
      if (this.config.verbose && Math.floor((n + buf.length) * 10 / numBytes) !== Math.floor(n * 10 / numBytes)) {
        console.log(session.localAddr, 'received', n + buf.length, 'bytes', (n + buf.length) / (1<<20) / (Date.now() - timeStart) * 1000, 'MB/s');
      }
    }
    console.log(session.localAddr, 'finished receiving', numBytes, 'bytes', numBytes / (1<<20) / (Date.now() - timeStart) * 1000, 'MB/s');
  }

  async write(session, numBytes) {
    let timeStart = Date.now();
    let buffer = new ArrayBuffer(4);
    let dv = new DataView(buffer);
    dv.setUint32(0, numBytes, true);
    await session.write(new Uint8Array(buffer));
    let buf;
    for (let n = 0; n < numBytes; n += buf.length) {
      buf = new Uint8Array(Math.min(numBytes - n, this.config.writeChunkSize));
      for (let i = 0; i < buf.length; i++) {
        buf[i] = this.byteAt(n + i);
      }
      await session.write(buf);
      if (this.config.verbose && Math.floor((n + buf.length) * 10 / numBytes) !== Math.floor(n * 10 / numBytes)) {
        console.log(session.localAddr, 'sent', n + buf.length, 'bytes', (n + buf.length) / (1<<20) / (Date.now() - timeStart) * 1000, 'MB/s');
      }
    }
    console.log(session.localAddr, 'finished sending', numBytes, 'bytes', numBytes / (1<<20) / (Date.now() - timeStart) * 1000, 'MB/s');
  }

  run() {
    console.log('Testing ' + this.name + '...');

    test(`[${this.name}] create`, async () => {
      let clientIDs = [''];
      for (var i = 0; i < this.config.numClients-1; i++) {
        clientIDs[i] = i + '';
      }
      this.alice = new ncp.Session('alice', 'bob', clientIDs, null, async (senderClientID, receiverClientID, buf) => {
        this.mockReceive(this.bob, receiverClientID, senderClientID, buf);
      }, this.config.sessionConfig);
      this.bob = new ncp.Session('bob', 'alice', clientIDs, null, async (senderClientID, receiverClientID, buf) => {
        this.mockReceive(this.alice, receiverClientID, senderClientID, buf);
      }, this.config.sessionConfig);
      expect(this.alice.localAddr).toBe('alice');
      expect(this.alice.remoteAddr).toBe('bob');
      expect(this.bob.localAddr).toBe('bob');
      expect(this.bob.remoteAddr).toBe('alice');
    });

    test(`[${this.name}] dial`, async () => {
      let promises = [this.dial(this.alice), this.accept(this.bob)];
      let r = await Promise.all(promises);
      expect(r.length).toStrictEqual(promises.length);
    });

    test(`[${this.name}] send`, async () => {
      let promises = [this.write(this.alice, this.config.numBytes), this.read(this.bob), this.write(this.bob, this.config.numBytes), this.read(this.alice)];
      let r = await Promise.all(promises);
      expect(r.length).toStrictEqual(promises.length);
    });

    test(`[${this.name}] close`, async () => {
      expect(await this.alice.close()).toBe(undefined);
      await ncp.util.sleep(2 * this.config.maxLatency + 100);
      expect(this.bob.isClosed).toBe(true);
    });
  }
}

new SessionTest('simple', {
  numClients: 4,
  numBytes: 8 << 20,
  writeChunkSize: 1024,
  minLatency: 0,
  maxLatency: 0,
  loss: 0,
}).run();

new SessionTest('single client', {
  numClients: 1,
  numBytes: 8 << 20,
  writeChunkSize: 1024,
  minLatency: 0,
  maxLatency: 0,
  loss: 0,
}).run();

new SessionTest('latency', {
  numClients: 4,
  numBytes: 8 << 20,
  writeChunkSize: 1024,
  minLatency: 100,
  maxLatency: 200,
  loss: 0,
}).run();

new SessionTest('packet loss', {
  numClients: 4,
  numBytes: 8 << 20,
  writeChunkSize: 1024,
  minLatency: 100,
  maxLatency: 200,
  loss: 0.01,
}).run();

new SessionTest('high packet loss', {
  numClients: 4,
  numBytes: 1 << 20,
  writeChunkSize: 1024,
  minLatency: 100,
  maxLatency: 200,
  loss: 0.1,
  sessionConfig: { sessionWindowSize: 1 << 16 },
}).run();

new SessionTest('minimal session window', {
  numClients: 4,
  numBytes: 1 << 4,
  writeChunkSize: 1,
  minLatency: 10,
  maxLatency: 20,
  loss: 0.01,
  sessionConfig: { sessionWindowSize: 1 },
}).run();

new SessionTest('big write chunk size', {
  numClients: 4,
  numBytes: 8 << 20,
  writeChunkSize: 16000,
  minLatency: 100,
  maxLatency: 200,
  loss: 0.01,
}).run();

new SessionTest('non stream', {
  numClients: 4,
  numBytes: 8 << 20,
  writeChunkSize: 1000,
  minLatency: 100,
  maxLatency: 200,
  loss: 0.01,
  sessionConfig: { nonStream: true },
}).run();
