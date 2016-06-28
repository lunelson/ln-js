//  _____                   _ _   _
// |_   _|                 (_) | (_)
//   | |_ __ __ _ _ __  ___ _| |_ _  ___  _ __
//   | | '__/ _` | '_ \/ __| | __| |/ _ \| '_ \
//   | | | | (_| | | | \__ \ | |_| | (_) | | | |
//   \_/_|  \__,_|_| |_|___/_|\__|_|\___/|_| |_|

const Emitter = require('./emitter.js');
const Gsap = require('./gsap').max();

class Transition extends Emitter {

  constructor(fn){
    super();
    this.fn = fn;
    this.TL = newBoundTimeline.call(this);
  }

  render(newContentLoad, oldContent, newState, oldState) {
    // this.newContentLoad = newContentLoad; // potentially unnecessary
    // this.oldContent = oldContent; // potentially unnecessary
    return new Promise((resolve) => {
      // this.one('complete', (arr) => { this.TL.clear(); resolve(arr); });
      // this.one('complete', () => { this.TL.clear(); resolve([newContentLoad, oldContent])}); // alternate
      this.one('complete', () => { this.TL.clear(); resolve(newContentLoad)}); // alternate
      // this.fn(this.TL, newState, newContentLoad, oldContent);
      this.fn.call(this, newContentLoad, oldContent, newState, oldState); // alternative: reference this.TL in function
      this.TL.play();
    });
  }
}

module.exports = Transition;

function newBoundTimeline() {
  return new (window.TimelineMax||window.TimelineLite)({
    paused: true,
    onStart: this.trigger,
    onStartParams: ['start', this.newContentLoad, this.oldContent], // TODO: verify, these args are passed
    onStartScope: this,
    onProgress: this.trigger,
    onProgressParams: ['progress', this.newContentLoad, this.oldContent],
    onProgressScope: this,
    onComplete: this.trigger,
    onCompleteParams: ['complete', this.newContentLoad, this.oldContent],
    onCompleteScope: this,
    onReverseComplete: this.trigger,
    onReverseCompleteParams: ['reverseComplete', this.newContentLoad, this.oldContent],
    onReverseCompleteScope: this
  });
}
