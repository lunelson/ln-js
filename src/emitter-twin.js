class TwinEmitter {

  constructor() { this.eventFnLists = {}; }

  on(event, measure, mutate) {
    let fnLists = this.eventFnLists[event] = this.eventFnLists[event] || {};
    let measureFnList = fnLists.measure = fnLists.measure || [];
    let mutateFnList = fnLists.mutate = fnLists.mutate || [];

    measure && (measure._pending = false);
    measureFnList.push(measure);

    mutate && (mutate._pending = false);
    mutateFnList.push(mutate);

    return measureFnList.length - 1;
  }

  trigger(event, ...args) {
    let measure = this.eventFnLists[event].measure;
    let mutate = this.eventFnLists[event].mutate;

    if (measure && !measure._pending) {
      measure._pending = true;
      setImmediate(() => { measure.apply(null, args); measure._pending = false; });
    }

    if (mutate && !mutate._pending) {
      mutate._pending = true;
      requestAnimationFrame(() => { mutate.apply(null, args); mutate._pending = false; });
    }
  }
}
