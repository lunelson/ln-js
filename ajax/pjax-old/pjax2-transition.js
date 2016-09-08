//  _____                   _ _   _
// |_   _|                 (_) | (_)
//   | |_ __ __ _ _ __  ___ _| |_ _  ___  _ __
//   | | '__/ _` | '_ \/ __| | __| |/ _ \| '_ \
//   | | | | (_| | | | \__ \ | |_| | (_) | | | |
//   \_/_|  \__,_|_| |_|___/_|\__|_|\___/|_| |_|

const Emitter = require('./emitter.js');

class Transition extends Emitter {

  constructor(outroFn, introFn){
    super();

    this.outroFn = outroFn;
    this.introFn = introFn;

    this.outroContent = null;
    this.outroData = null;
    this.introContent = null;
    this.introData = null;

    this.outroTL = this.makeTL('outro');
    this.introTL = this.makeTL('intro');

    this.outroRun = null;
    this.introRun = null;
  }

  progress() { return this.outroTL.progress()||0 + this.introTL.progress()||0; }

  // TODO: update anchorEl to a clickObj, with more information
  runOutro(oldContainer, anchorEl){
    this.outroContent = oldContainer;
    this.outroData = oldContainer.dataset;
    this.outroRun = new Promise((resolve, reject) => {
      this.one('outroComplete', () => {
        this.outroTL.clear();
        resolve(oldContainer);
      });
      this.outroFn(oldContainer, this.outroTL, anchorEl);
      this.outroTL.play();
    });
    return this.outroRun;
  }

  runIntro(newContainer){
    this.introContent = newContainer;
    this.introData = newContainer.dataset;
    this.introRun = new Promise((resolve, reject) => {
      this.one('introComplete', () => {
        this.introTL.clear();
        resolve(newContainer);
      });
      this.introFn(newContainer, this.introTL);
      this.introTL.play();
    });
    return this.introRun;
  }

  recover(anchorEl){
    // ? cancel/kill existing promises?
    if (this.progress() <= 1) return this.outroRun;
    return new Promise((resolve, reject)=>{
      this.one('introReverseComplete', () => resolve(anchorEl));
      this.introTL.reverse();
    });
  }

  makeTL(namespace) {
    return new (window.TimelineMax||window.TimelineLite)({
      paused: true,
      onStart: this.trigger,
      onStartParams: [`${namespace}Start`],
      onStartScope: this,
      onProgress: this.trigger,
      onProgressParams: [`${namespace}Progress`],
      onProgressScope: this,
      onComplete: this.trigger,
      onCompleteParams: [`${namespace}Complete`],
      onCompleteScope: this,
      onReverseComplete: this.trigger,
      onReverseCompleteParams: [`${namespace}ReverseComplete`],
      onReverseCompleteScope: this
    });
  }
}

module.exports = Transition;
