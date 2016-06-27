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
    this.tl = newBoundTimeline.call(this);

  }

  render(newAction, newDoc, currDoc) {
    this.newDoc = newDoc;
    this.currDoc = currDoc;
    return new Promise((resolve) => {
      this.one('complete', (arr) => { this.tl.clear(); resolve(arr)});
      this.fn(tl, clickTarget, newDoc, currDoc);
      this.tl.play();
    });
  }
}

function newBoundTimeline() {
  return new (window.TimelineMax||window.TimelineLite)({
    paused: true,
    onStart: this.trigger,
    onStartParams: ['start', this.newDoc, this.currDoc],
    onStartScope: this,
    onProgress: this.trigger,
    onProgressParams: ['progress', this.newDoc, this.currDoc],
    onProgressScope: this,
    onComplete: this.trigger,
    onCompleteParams: ['complete', this.newDoc, this.currDoc],
    onCompleteScope: this,
    // onReverseComplete: this.trigger,
    // onReverseCompleteParams: ['reverseComplete', this.newDoc, this.currDoc],
    // onReverseCompleteScope: this
  });
}

module.exports = Transition;
