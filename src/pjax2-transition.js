const Emitter = require('./emitter.js');

// TRANSITION
class Transition extends Emitter {

  constructor(outroFn, introFn){
    super();

    this.outroFn = outroFn;
    this.introFn = introFn;

    this.outroTL = new Timeline();
    this.outroTL.onStart = () => this.emit('outroStart');
    this.outroTL.onProgress = () => this.emit('outroProgress');
    this.outroTL.onComplete = () => this.emit('outroComplete');
    this.outroTL.onReverseComplete = () => this.emit('outroReverseComplete');

    this.introTL = new Timeline();
    this.introTL.onStart = () => this.emit('introStart');
    this.introTL.onProgress = () => this.emit('introProgress');
    this.introTL.onComplete = () => this.emit('introComplete');
    this.introTL.onReverseComplete = () => this.emit('introReverseComplete');

    this.outroRun = null;
    this.introRun = null;
  }

  progress() { return this.outroTL.progress()||0 + this.introTL.progress()||0; }

  runOutro(anchorEl){
    this.outroRun = new Promise((resolve, reject) => {
      this.on('outroComplete', () => resolve(anchorEl));
      this.outroFn(anchorEl, this.outroTL, this.pjax);
    });
    return this.outroRun;
  }

  // runOutro(anchorEl){ return Promise.resolve(); }

  runIntro(container, anchorEl){
    this.introRun = new Promise((resolve, reject) => {
      this.on('introComplete', () => resolve(container));
      this.introFn(container, this.introTL, this.pjax);
    });
    return this.introRun;
  }

  recover(anchorEl){
    // ? cancel/kill existing promises?
    if (this.progress() <= 1) return this.outroRun;
    return new Promise((resolve, reject)=>{
      this.on('introReverseComplete', () => resolve(anchorEl));
      this.introTL.reverse();
    });
  }
}

module.exports = Transition;
