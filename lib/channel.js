'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _channel = _interopRequireDefault(require("@nodeguy/channel"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Channel extends _channel.default {
  static selectValue(methodPromises) {
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
            resolve((await promise));
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
  }

}

exports.default = Channel;