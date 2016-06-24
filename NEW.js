const Emitter = require('./emitter');

const Pjax = Object.assign(new Emitter(), {
  init() {
    if (this.initialized) throw new Error('Pjax: attempted to initialize twice');
    this.initialized = true;
    // more init here
    return this;
  }
});

class Cache {
  constructor() { this.reset(); this.active = true; }
  reset() { if (this.active) this.data = {}; }
  get(key) { return this.active ? (this.data[key] || null) : null; } // does this fail?
  set(key, val) { if (this.active) this.data[key] = val; return val; }
  get length() { return Object.keys(this.data).length; }
}

class HistoryStack {
  constructor() {
    this.keys = [];
    this.vals = [];
    this.index = -1;
  }
  push(key, val) {
    this.keys = this.keys.slice(this.index - 1);
    this.vals = this.vals.slice(this.index - 1);
    this.index = this.keys.push(key) - 1; // index = length - 1
    return this.vals.push(val); // length returned
  }
  seek(key) { this.index = this.keys.indexOf(key); return this.curr(); }
  goto(n) { this.index = n; return this.curr(); }
  go(n) { this.index += n; return this.curr(); }
  curr() { return this.vals[this.index] || null; }
  prev() { return this.vals[this.index - 1] || null; }
  next() { return this.vals[this.index + 1] || null; }
  get length() { return this.vals.length; }
}

const Media = Object.assign(new Emitter(), {
  getCSS(){},
  onChange(){},
  onBelow(){},
  onAbove(){},
  breakPoints(){},
});

/* how to set and choose transition */

Pjax.setTransition((url)=>{/* return Transition wrt URL */})

Pjax.prevContainer;
Pjax.currContainer;
Pjax.setContainer(html) // if no HTML, use document.body
Pjax.prevTransition
Pjax.currTransition
Pjax.setTransition(url) // if no URL, return current transition

//-----------

const myTrans = new Pjax.Transition({
  render(oldContainer, clickObj, docLoadPromise){/* use this.timeline */},
  recover(){/* use this.timeline */},
});

Pjax.setTransition = (url) => {

}

var Gsap = require('./gsap');
Gsap.init('liteLite'); // do not init more than once
var myTween = new Gsap.Tween();
var myTimeline = new Gsap.Timeline();

const myTrans = new Pjax.Transition((transTimeline, oldContainer, clickObj, docLoadPromise) => {

})

/*===================================*/

init()
  this.transRun = Promise.resolve(Dom.parseContainer(this.root));

handlePointer(event)
  // if link and prefetch-link and pjax-link and prefetch=true
  // Cache.set(url, Ajax.get(url))

handleClick(event)
  // validate
  // currAction = navStack.curr()
  // newAction = {url: event.target.href, stamp: Date.now()}
  // navStack.push(newAction.stamp, newAction)
  // newAction.click = event.target
  // handleAction(newAction, currAction)

handlePopState(event)
  // currAction = navStack.curr()
  // newAction = navStack.seek(window.history.state)
  // newAction.popstate = (newAction.stamp < currAction.stamp) ? 'back' : 'forward'
  // handleNavAction(newAction, currAction)

handleNavAction(newAction, currAction)
  // given curr and prev navigation newActions, we should be able to handle it all here

  // create a Promise for new doc load, with some additional processing
  let newDocLoad = loadNewDoc(newAction).then(([newAction, html]) => {
    if (newAction.element) { /* do history push state */}
    // other stuff
    return newDoc;
  });
  // chain new transition on to transitionRun promise
  this.transRun = this.transRun.then(([currDoc, prevDoc])=>{
    return this.runTrans(newAction, currAction, newDocLoad, currDoc); // returns [currDoc, prevDoc]
  }).then(([currDoc, prevDoc])=>{
    // do any final cleanups here
  });

runTrans(newAction, oldDoc, newDoc)
  var trans = this.getTrans(newAction.url, currAction.url)
  reurn trans.run()