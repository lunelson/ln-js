//                 _ _   _                                                  _
//                (_) | | |                                                | |
//   ___ _ __ ___  _| |_| |_ ___ _ __ ______ _ __ ___  __ _ _   _  ___  ___| |_
//  / _ \ '_ ` _ \| | __| __/ _ \ '__|______| '__/ _ \/ _` | | | |/ _ \/ __| __|
// |  __/ | | | | | | |_| ||  __/ |         | | |  __/ (_| | |_| |  __/\__ \ |_
//  \___|_| |_| |_|_|\__|\__\___|_|         |_|  \___|\__, |\__,_|\___||___/\__|
//                                                       | |
//                                                       |_|

require('setimmediate');

function requestable(fn, cancellable = false) {
  function cb(...args){ fn.apply(null, args); cb._pending = null; }
  cb._pending = null;
  cb._cancellable = cancellable;
  return cb;
}

function callbackify(fn, args) { return function(){ fn.apply(null, args); } }

class RequestEmitter {

  constructor() { this.fnSets = {}; }

  on(event, measure, mutate, cancellable = [false, false]) {

    let fnSet = this.fnSets[event] = this.fnSets[event] || {};
    let measureFns = fnSet.measure = fnSet.measure || [];
    let mutateFns = fnSet.mutate = fnSet.mutate || [];

    measure && (measure = requestable(measure, cancellable[0]));
    mutate && (mutate = requestable(mutate, cancellable[1]));

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
      if (measure && !measure._pending) { measure._pending = setImmediate(measure, ...args); }
    });

    mutateFns && mutateFns.forEach((mutate) => {
      if (mutate && mutate._pending && mutate._cancellable) { cancelAnimationFrame(mutate._pending); }
      if (mutate && !mutate._pending) { mutate._pending = requestAnimationFrame(callbackify(mutate, args)); }
    });
  }
}
