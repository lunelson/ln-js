//  _____          _ _   _
// |  ___|        (_) | | |
// | |__ _ __ ___  _| |_| |_ ___ _ __
// |  __| '_ ` _ \| | __| __/ _ \ '__|
// | |__| | | | | | | |_| ||  __/ |
// \____/_| |_| |_|_|\__|\__\___|_|

// TODO make a fallback, if window.setImmediate does not exist ?
require('setimmediate');

class Emitter {

  constructor() { this.events = {}; }

  on(evt, fn, now = false) {
    this.events[evt] = this.events[evt] || [];
    this.events[evt].push(fn);
    if (now) fn();
    return this;
  }

  one(evt, fn, now = false) {
    fn._once = true;
    this.on(evt, fn, now);
    return this;
  }

  // reqOn(evt, fn, now = false) {
  //   fn._reqd = true;
  //   this.on(evt, fn, now);
  //   return this;
  // }

  off(evt, fn = false) {
    fn ?
      this.events[evt].splice(this.events[evt].indexOf(fn), 1):
      delete this.events[evt];
    return this;
  }

  // request(evt, ...args) {
  //   const fnList = this.events[evt] && this.events[evt].slice();
  //   fnList && fnList.forEach((fn) => {
  //     fn._once && this.off(evt, fn);
  //     fn._reqd && window.requestAnimationFrame(fn.bind(null, ...args));
  //   });
  //   return this;
  // }

  trigger(evt, ...args) {
    const fnList = this.events[evt] && this.events[evt].slice();
    fnList && fnList.forEach((fn) => {
      fn._once && this.off(evt, fn);
      setImmediate(fn.bind(this, ...args));
      // fn.apply(this, args);
    });
    // TODO: test if following code is actually faster
    // let n;
    // if (this.events[evt] && (n = this.events[evt].length)) {
    //   while (n--) {
    //     let fn = this.events[evt][n];
    //     fn._once && this.off(evt, fn);
    //     fn.apply(this, args);
    //   }
    // }
    return this;
  }
}

module.exports = Emitter;
