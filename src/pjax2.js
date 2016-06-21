
// Promise polyfill
// alt: https://github.com/taylorhakes/promise-polyfill
// alt: https://github.com/getify/native-promise-only
if (typeof Promise !== 'function') { window.Promise = require('bluebird'); }

// general

// pjax specific stuff
const Dispatcher   = require('./pjax2-dispatcher');
const Transition = require('./pjax2-transition');
const Dom          = require('./pjax2-dom');
const Utils        = require('./pjax2-utils');

const Cache        = require('./pjax2/cache');
const HistMgr      = require('./pjax2/history');
const Prefetch     = require('./pjax2/prefetch');
const View         = require('./pjax2/view');

const defaultTransition =  require('./pjax2-transition-default');

// log function for errors
const log = (console) ? console.log.bind(console) : function(){}

// get current URL
function currUrl() { return Utils.cleanLink( Utils.currUrl() ); }

// load a new page; return Promise
function loadNewContainer(url) {
  // TODO: make better conditional logic here, wrt cacheEnabled flag
  // console.log(`cached: ${Cache.get(url)}`);
  return Promise.resolve(Cache.get(url) || Utils.getHTML(url))
  .then((html) => {
    Cache.set(url, html);
    var container = Dom.parseNewContainer(html);
    Dom.appendContainer(container);
    if (!Pjax.cacheEnabled) Cache.reset();
    return container;
  }, (error) => {
      window.location = url;
      console.log(error);
  });
}

// click handler
function handleClick(event) {

  // resolve the element
  var element = event.target; while (element && !element.href) { element = element.parentNode; }

  // proceed if element is valid for pjax
  if (Utils.validLink(element, event)) {

    // stop native event
    event.stopPropagation();
    event.preventDefault();

    // update and trigger stuff
    window.history.pushState(null, null, element.href);
    Dispatcher.trigger('linkClick', element);
    this.lastClicked = element;
    handleStateChange.call(this, element);
  }
}

// stateChange handler
function handleStateChange(anchorEl) {
  // console.log(`current this reference is ${this}`);

  // get new URL, after push-/popstate action
  var newUrl = currUrl();
  // console.log(`link is ${currUrl}`);

  // bail out, if this is the same as the one currently stored in history manager
  if (HistMgr.currStatus().url === newUrl) return false;
  // console.log(`link is same as current?: ${HistMgr.currStatus().url === newUrl}`);

  // whatever the state of current load, we can re-assign it
  // this.newContainerLoad.cancel();
  this.newContainerLoad = loadNewContainer(newUrl); // check
  this.newContainerLoad.then(log);


  // ...and deal with transition accordingly
  if (this.currTrans.progress() > 0) {
      // if in progress, recover the current transition and run 'intro' of new one
      // this.transitionRun.cancel();
      this.transitionRun = Promise
        .all([this.newContainerLoad, this.currTrans.recover()])
        // NB runIntro will receive container as first arg
        .then(this.setCurrTrans(newUrl).runIntro);
  } else {
      // ...otherwise run outro and intro of current
      this.transitionRun = Promise
        // NB reset previous transition, and set this.currTrans to new one, based on current link
        .all([this.newContainerLoad, this.setCurrTrans(newUrl).runOutro(anchorEl)])
        // NB runIntro will receive container as first arg
        .then(this.currTrans.runIntro);
  }

  // fire internal events -- isn't the info loged on this line out of date?
  Dispatcher.trigger('stateChange', HistMgr.currStatus(), HistMgr.prevStatus());

  // add URL to internal history manager
  HistMgr.add(newUrl);

  // update statuses when container is loaded
  this.newContainerLoad.then((container)=>{
    var currStatus = HistMgr.currStatus();
    currStatus.namespace = Dom.containerNamespace(container);
    Dispatcher.trigger('newContainerLoad',
      HistMgr.currStatus(),
      HistMgr.prevStatus(),
      container
    );
    return true;
  }).catch(log);

  // fire transition end update
  this.transitionRun.then(()=>{
    Dispatcher.trigger('transitionEnd',
      HistMgr.currStatus(),
      HistMgr.prevStatus()
    );
    return true;
  }).catch(log);
}

// PJAX
var Pjax = {
  // newContainerLoad: Promise.resolve(Dom.currContainer()),
  newContainerLoad: null,
  currTrans: null,
  setCurrTrans(url) {
    // reset this.currTrans
    // determine a new one, based on incoming URL
    this.currTrans = defaultTransition;
    return this.currTrans;
  },

  // whether to use cache
  cacheEnabled: true,
  // last clicked element
  lastClicked: null,

  // initialize
  init: function() {

    // get the container
    var container = Dom.currContainer();

    this.setCurrTrans();

    HistMgr.add(
      currUrl(),
      Dom.containerNamespace(container)
    );

    // fire custom events for the current view.
    Dispatcher.trigger('stateChange', HistMgr.currStatus());
    Dispatcher.trigger('newContainerLoad', HistMgr.currStatus(), {}, container);
    Dispatcher.trigger('transitionEnd', HistMgr.currStatus());

    // bind native events
    document.addEventListener('click', handleClick.bind(this));
    window.addEventListener('popstate', handleStateChange.bind(this));
  },

  // exposure of other objects
  Cache: Cache,
  Dom: Dom,
  HistMgr: HistMgr,
  Prefetch: Prefetch,
  Transition: Transition,
  Utils: Utils,
  View: View
};

module.exports = Pjax;
