//                 _ _   _
//                (_) | | |
//   ___ _ __ ___  _| |_| |_ ___ _ __ ______ __ _ ___ _   _ _ __   ___
//  / _ \ '_ ` _ \| | __| __/ _ \ '__|______/ _` / __| | | | '_ \ / __|
// |  __/ | | | | | | |_| ||  __/ |        | (_| \__ \ |_| | | | | (__
//  \___|_| |_| |_|_|\__|\__\___|_|         \__,_|___/\__, |_| |_|\___|
//                                                     __/ |
//                                                    |___/

require('setimmediate');

function applyAndReset(fn, args) { fn.apply(null, args); fn._pending = false; }

class AsyncEmitter {

  constructor() { this.fnSets = {}; }

  on(event, measure, mutate, cancellable = [false, false]) {
    let fnSet = this.fnSets[event] = this.fnSets[event] || {};
    let measureFns = fnSet.measure = fnSet.measure || [];
    let mutateFns = fnSet.mutate = fnSet.mutate || [];

    if (measure) {
      measure._pending = false;
      measure._cancellable = cancellable[0];
    }
    if (mutate) {
      mutate._pending = false;
      mutate._cancellable = cancellable[1];
    }

    measureFns.push(measure);
    mutateFns.push(mutate);

    return measureFns.length - 1;
  }

  trigger(event, ...args) {
    let fnSet = this.fnSets[event];
    let measureFns = fnSet.measure;
    let mutateFns = fnSet.mutate;

    measureFns && measureFns.forEach((measure) => {
      if (measure && measure._pending && measure._cancellable) { clearImmediate(measure._pending); }
      if (measure && !measure._pending) { measure._pending = setImmediate(applyAndReset.bind(null, measure, args)); }
    });

    mutateFns && mutateFns.forEach((mutate) => {
      if (mutate && mutate._pending && mutate._cancellable) { cancelAnimationFrame(mutate._pending); }
      if (mutate && !mutate._pending) { mutate._pending = requestAnimationFrame(applyAndReset.bind(null, mutate, args)); }
    });
  }
}
