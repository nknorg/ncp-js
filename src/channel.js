'use strict';

import BaseChannel from '@nodeguy/channel';

export default class Channel extends BaseChannel {
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
  };
}
