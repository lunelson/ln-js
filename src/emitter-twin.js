class TwinEmitter {

  constructor() { this.eventFnLists = {}; }

  on(event, measure, mutate) {
    let fnLists = this.eventFnLists[event] = this.eventFnLists[event] || {};

    let measureFnList = fnLists.measure = fnLists.measure || [];
    measure && (measure._pending = false);
    measureFnList.push(measure);

    let mutateFnList = fnLists.mutate = fnLists.mutate || [];
    mutate && (mutate._pending = false);
    mutateFnList.push(mutate);

    return measureFnList.length - 1;
  }

  emit(event, ...args) {
    let measure = this.eventFnLists[event].measure;

    if (measure && !measure._pending) {
      measure._pending = true;
      requestImmediate(() => { measure(); measure._pending = false; });
    }

    let mutate = this.eventFnLists[event].mutate;
    if (mutate && !mutate._pending) {
      mutate._pending = true;
      requestAnimationFrame(() => { mutate(); mutate._pending = false; });
    }
  }
}
