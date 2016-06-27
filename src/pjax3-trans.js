//  _____                   _ _   _
// |_   _|                 (_) | (_)
//   | |_ __ __ _ _ __  ___ _| |_ _  ___  _ __
//   | | '__/ _` | '_ \/ __| | __| |/ _ \| '_ \
//   | | | | (_| | | | \__ \ | |_| | (_) | | | |
//   \_/_|  \__,_|_| |_|___/_|\__|_|\___/|_| |_|

const Emitter = require('./emitter.js');

class Transition extends Emitter {

  constructor(fn){
    super();
    this.fn = fn;
    this.TL = newTriggerTL.call(this);
  }

  render(newAction, newDoc, currDoc) {
    this.newDoc = newDoc; // potentially unnecessary
    this.currDoc = currDoc; // potentially unnecessary
    return new Promise((resolve) => {
      this.one('complete', (arr) => { this.TL.clear(); resolve(arr); });
      // this.one('complete', () => { this.TL.clear(); resolve([newDoc, currDoc])}); // alternate
      this.fn(TL, newAction, newDoc, currDoc);
      // this.fn(newAction, newDoc, currDoc); // alternative: reference this.TL in function
      this.TL.play();
    });
  }
}

module.exports = Transition;

function newTriggerTL() {
  return new (window.TimelineMax||window.TimelineLite)({
    paused: true,
    onStart: this.trigger,
    onStartParams: ['start', this.newDoc, this.currDoc], // TODO: verify, these args are passed
    onStartScope: this,
    onProgress: this.trigger,
    onProgressParams: ['progress', this.newDoc, this.currDoc],
    onProgressScope: this,
    onComplete: this.trigger,
    onCompleteParams: ['complete', this.newDoc, this.currDoc],
    onCompleteScope: this,
    onReverseComplete: this.trigger,
    onReverseCompleteParams: ['reverseComplete', this.newDoc, this.currDoc],
    onReverseCompleteScope: this
  });
}
