//  _____          _ _   _
// |  ___|        (_) | | |
// | |__ _ __ ___  _| |_| |_ ___ _ __
// |  __| '_ ` _ \| | __| __/ _ \ '__|
// | |__| | | | | | | |_| ||  __/ |
// \____/_| |_| |_|_|\__|\__\___|_|

class Emitter {

  constructor(){ this.events = {}; }

  on(evt, fn) {
    this.events[evt] = this.events[evt] || [];
    this.events[evt].push(fn);
    return this;
  }

  one(evt, fn) {
    fn._once = true;
    this.on(evt, fn);
    return this;
  }

  off(evt, fn = false) {
    fn ?
      this.events[evt].splice(this.events[evt].indexOf(fn), 1):
      delete this.events[evt];
    return this;
  }

  trigger(evt, ...args) {
    // cache the this.events, to avoid consequences of mutation
    const cache = this.events[evt] && this.events[evt].slice()
    // only fire fns if they exist
    cache && cache.forEach((fn) => {
      // remove fns added with 'once'
      fn._once && this.off(evt, fn)
      // set 'this' context, pass args to fns
      fn.apply(this, args)
    })
    return this;
  }
}

module.exports = Emitter;
