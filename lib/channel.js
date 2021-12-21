// Modified verison of
// https://gitlab.com/NodeGuy/channel/-/blob/master/lib/index.js
//
// A few things are changed:
//
// - Fix the issue that shifts, pushes, preonFulfilleds are not cleared when
//   cancelled to prevent memory leak for long lived channel
//
// - Add Channel.selectValue method
"use strict";

require(`setimmediate`); // An order represents a pending push or shift.


const Order = channel => {
  let order;
  const preonFulfilleds = [];
  const promise = new Promise((resolve, reject) => {
    order = {
      resolve: value => {
        preonFulfilleds.forEach(preonFulfilled => {
          preonFulfilled(value);
        });
        resolve(value);
      },
      reject
    };
  });
  Object.assign(promise, {
    cancel: () => {
      order.cancelled = true;
      preonFulfilleds.splice(0, preonFulfilleds.length);
    },
    channel,
    prethen: onFulfilled => {
      preonFulfilleds.push(onFulfilled);
    }
  });
  return {
    order,
    promise
  };
};

const prototype = {}; // Create a new channel with a buffer the size of "length".

const Channel = function (length = 0) {
  let buffered = 0;
  let closed = false;
  let lastValue;
  const pushes = [];
  const shifts = [];

  const matchPushesAndShifts = index => {
    while (index.push < pushes.length && index.shift < shifts.length) {
      const push = pushes[index.push];
      const shift = shifts[index.shift];

      if (push.cancelled) {
        index.push++;
      } else if (shift.cancelled) {
        index.shift++;
      } else {
        lastValue = push.value;
        shift.resolve(lastValue);
        index.shift++;
        push.resolve(length);
        index.push++;
        buffered = Math.max(0, buffered - 1);
      }
    }
  }; // Resolve push promises up to the end of the buffer.


  const resolveBufferedPushes = index => {
    for (let resolvedIndex = index.push + buffered; resolvedIndex < pushes.length && buffered < length; resolvedIndex++) {
      const {
        cancelled,
        resolve
      } = pushes[resolvedIndex];

      if (!cancelled) {
        buffered++;
        resolve(length);
      }
    }
  };

  const resolveClosedShifts = index => {
    for (; index.shift < shifts.length; index.shift++) {
      const {
        cancelled,
        resolve
      } = shifts[index.shift];

      if (!cancelled) {
        lastValue = undefined;
        resolve(lastValue);
      }
    }
  };

  const removeCancelled = () => {
    for (let i = 0; i < pushes.length; i++) {
      if (pushes[i].cancelled) {
        pushes.splice(i, 1);
        i--;
      }
    }

    for (let i = 0; i < shifts.length; i++) {
      if (shifts[i].cancelled) {
        shifts.splice(i, 1);
        i--;
      }
    }
  }; // Process the push and shift queues like an order book, looking for matches.


  const processOrders = () => {
    const index = {
      push: 0,
      shift: 0
    };
    matchPushesAndShifts(index);
    resolveBufferedPushes(index); // If the channel is closed then resolve 'undefined' to remaining shifts.

    if (closed) {
      resolveClosedShifts(index);
    }

    pushes.splice(0, index.push);
    shifts.splice(0, index.shift);
    removeCancelled();
  };

  const readOnly = Object.freeze(Object.assign(Object.create(prototype), {
    concat: (...args) => {
      const output = Channel();

      (async () => {
        await readOnly.forEach(output.push);

        for (let index = 0; index < args.length; index++) {
          const arg = args[index];
          /* For some reason the following code works in Mocha but not in
            Wallaby.js:
             await (Channel.isChannel(arg)
              ? arg.forEach(output.push)
              : output.push(arg));
             If we use the 'if' statement below then Wallaby.js is happy.
          */

          if (Channel.isChannel(arg)) {
            await arg.forEach(output.push);
          } else {
            await output.push(arg);
          }
        }

        await output.close();
      })();

      return output;
    },
    every: async (callbackfn, thisArg) => {
      for (;;) {
        const value = await readOnly.shift();

        if (value === undefined) {
          return true;
        } else {
          if (!callbackfn.call(thisArg, value)) {
            return false;
          }
        }
      }
    },
    filter: (callbackfn, thisArg) => {
      const output = Channel();

      (async () => {
        await readOnly.forEach(async value => {
          if (await callbackfn.call(thisArg, value)) {
            await output.push(value);
          }
        });
        await output.close();
      })();

      return output;
    },
    forEach: async (callbackfn, thisArg) => {
      for (;;) {
        const value = await readOnly.shift();

        if (value === undefined) {
          break;
        } else {
          await callbackfn.call(thisArg, value);
        }
      }
    },
    join: async separator => (await readOnly.values()).join(separator),
    map: (callbackfn, thisArg) => {
      const output = Channel();

      (async () => {
        await readOnly.forEach(value => output.push(callbackfn.call(thisArg, value)));
        await output.close();
      })();

      return output;
    },
    readOnly: () => readOnly,
    reduce: async (callbackfn, ...initialValue) => {
      let previousValue = initialValue[0];
      let previousValueDefined = initialValue.length > 0;
      await readOnly.forEach(currentValue => {
        if (previousValueDefined) {
          previousValue = callbackfn(previousValue, currentValue);
        } else {
          previousValue = currentValue;
          previousValueDefined = true;
        }
      });

      if (previousValueDefined) {
        return previousValue;
      } else {
        throw new TypeError(`No values in channel and initialValue wasn't provided.`);
      }
    },
    shift: function () {
      const {
        order,
        promise
      } = Order(this);
      shifts.push(order);
      setImmediate(processOrders); // Don't freeze promise because Bluebird expects it to be mutable.

      return promise;
    },
    slice: (start, end = Infinity) => {
      const output = Channel();

      (async () => {
        // Consume values before the starting point.
        for (let index = 0; index < start; index++) {
          await readOnly.shift();
        }

        for (let index = start; index < end; index++) {
          const value = await readOnly.shift();

          if (value === undefined) {
            break;
          } else {
            await output.push(value);
          }
        }

        await output.close();
      })();

      return output;
    },
    some: async (callbackfn, thisArg) => {
      for (;;) {
        const value = await readOnly.shift();

        if (value === undefined) {
          return false;
        } else {
          if (callbackfn.call(thisArg, value)) {
            return true;
          }
        }
      }
    },
    toString: () => `Channel(${length})`,
    value: () => lastValue,
    values: async () => {
      const array = [];
      await readOnly.forEach(item => {
        array.push(item);
      });
      return array;
    }
  }));
  const writeOnly = Object.freeze(Object.assign(Object.create(prototype), {
    close: () => new Promise((resolve, reject) => {
      if (closed) {
        reject(new Error(`Can't close an already-closed channel.`));
      } else {
        closed = true;
        processOrders(); // Give remaining orders in flight time to resolve before returning.

        setImmediate(resolve);
      }
    }),
    length,
    push: function (value) {
      const {
        order,
        promise
      } = Order(this);
      order.value = value; // If value is a promise that rejects, catch it in case there hasn't
      // been a matching shift yet in order to prevent an unhandledRejection
      // error.

      Promise.resolve(value).catch(() => {});

      if (closed) {
        order.reject(new Error(`Can't push to closed channel.`));
      } else if (value === undefined) {
        order.reject(new TypeError(`Can't push 'undefined' to channel, use close instead.`));
      } else if (arguments.length > 1) {
        order.reject(new Error(`Can't push more than one value at a time.`));
      } else {
        pushes.push(order);
        setImmediate(processOrders);
      } // Don't freeze promise because Bluebird expects it to be mutable.


      return promise;
    },
    writeOnly: () => writeOnly
  }));
  return Object.freeze(Object.assign(Object.create(prototype), readOnly, writeOnly));
}; // Node.js stream.readable


const fromNodeStream = (channel, stream) => {
  stream.on(`readable`, async () => {
    for (;;) {
      const data = stream.read();

      if (data === null) {
        break;
      } else {
        await channel.push(data);
      }
    }
  });
  stream.once(`end`, channel.close);
};

Channel.from = (values, mapfn, thisArg) => {
  const channel = Channel();

  (async () => {
    // iterable
    try {
      for (let value of values) {
        await channel.push(value);
      }

      await channel.close();
    } catch (exception) {
      // callback function
      try {
        for (;;) {
          const value = values();

          if (value === undefined) {
            await channel.close();
            break;
          } else {
            await channel.push(value);
          }
        }
      } catch (exception) {
        fromNodeStream(channel, values);
      }
    }
  })();

  return (mapfn ? channel.map(mapfn, thisArg) : channel).readOnly();
};

Channel.of = (...values) => Channel.from(values);

Channel.isChannel = value => value !== undefined && value !== null && Object.getPrototypeOf(value) === prototype;

Channel.select = methodPromises => {
  if (!Array.isArray(methodPromises)) {
    throw new TypeError(`Channel.select: Argument must be an array.`);
  }

  const selectPromise = new Promise((resolve, reject) => {
    methodPromises.forEach(async promise => {
      try {
        promise.prethen(() => {
          // We've been given a heads-up that this method will complete first
          // so cancel the other method calls.
          methodPromises.forEach(other => {
            if (other !== promise) {
              other.cancel();
            }
          });
        });

        try {
          await promise;
        } catch (exception) {
          reject(exception);
        }

        resolve(promise.channel);
      } catch (exception) {
        reject(new TypeError(`Channel.select accepts only promises returned by push & shift.`));
      }
    });
  });
  return Object.assign(selectPromise, {
    cancel: () => methodPromises.forEach(promise => promise.cancel())
  });
};

Channel.selectValue = methodPromises => {
  if (!Array.isArray(methodPromises)) {
    throw new TypeError(`Channel.select: Argument must be an array.`);
  }

  const selectPromise = new Promise((resolve, reject) => {
    methodPromises.forEach(async promise => {
      try {
        promise.prethen(() => {
          methodPromises.forEach(other => {
            if (other !== promise) {
              other.cancel();
            }
          });
        });

        try {
          resolve(await promise);
        } catch (exception) {
          reject(exception);
        }
      } catch (exception) {
        reject(new TypeError(`Channel.select accepts only promises returned by push & shift.`));
      }
    });
  });
  return Object.assign(selectPromise, {
    cancel: () => methodPromises.forEach(promise => promise.cancel())
  });
}; // functional interface allowing full or partial application
//
// Channel.slice(10, Infinity, channel)
// Channel.slice(10, Infinity)(channel)
// Channel.slice(10)(Infinity)(channel)


const channel = Channel();
const methods = Object.keys(channel).filter(method => typeof channel[method] === `function`);
const arities = {
  reduce: 2,
  slice: 2
};
methods.forEach(method => {
  const bound = function (...args) {
    const arity = arities[method] || channel[method].length;
    return args.length > arity ? args[arity][method](...args.slice(0, arity)) : bound.bind(this, ...args);
  };

  Channel[method] = bound;
});
module.exports = Object.freeze(Channel);