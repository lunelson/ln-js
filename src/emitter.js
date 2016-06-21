// EMITTER
class Emitter {
  constructor(){ this.events = {}; }

  on(e, f) {
    this.events[e] = this.events[e] || [];
    this.events[e].push(f);
  }

  off(e, f) {
    if(e in this.events === false)
      return;

    this.events[e].splice(this.events[e].indexOf(f), 1);
  }

  trigger(e) {//e, ...args
    if (e in this.events === false)
      return;

    for(var i = 0; i < this.events[e].length; i++){
      this.events[e][i].apply(this, Array.prototype.slice.call(arguments, 1));
    }
  }
}

module.exports = Emitter;
