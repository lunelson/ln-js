// ______ _                   _____  _____
// | ___ (_)                 |  __ \/  ___|
// | |_/ /_  __ ___  ________| |  \/\ `--.
// |  __/| |/ _` \ \/ /______| | __  `--. \
// | |   | | (_| |>  <       | |_\ \/\__/ /
// \_|   | |\__,_/_/\_\       \____/\____/
//      _/ |
//     |__/

// Promise polyfills
// full--https://github.com/petkaantonov/bluebird
// min--https://github.com/stefanpenner/es6-promise
// alt--https://github.com/taylorhakes/promise-polyfill
// alt--https://github.com/getify/native-promise-only
if (typeof Promise !== 'function') { window.Promise = require('bluebird'); }

// Fetch polyfill
// https://github.com/github/fetch
if (typeof fetch !== 'function') { window.fetch = require('whatwg-fetch'); }

// Greensock
// core: lite(), liteLite(), liteMax(), max()
// opts: jquery(), plugins([list]), draggable()
require('./gsap').max();

// Other Deps
const Ajax       = require('./ajax');
const Cache      = require('./pjax2-cache');
const Dispatcher = require('./pjax2-dispatcher');
const Dom        = require('./pjax2-dom');
const Emitter    = require('./emitter.js');
const HistMgr    = require('./pjax2-history');
const Prefetch   = require('./pjax2-prefetch');
const Transition = require('./pjax2-transition');
const Utils      = require('./pjax2-utils');
const View       = require('./pjax2-view');

const Pjax = Object.assign(Object.create(Emitter.prototype), {

  // newContainerLoad: Promise.resolve(Dom.currContainer()),
  currContainer: null,
  currTrans: null,
  setCurrTrans(url) {
    // reset this.currTrans
    // determine a new one, based on incoming URL
    this.currTrans = require('./pjax2-transition-default');
    return this.currTrans;
  },

  // whether to use cache
  cacheEnabled: true,
  // last clicked element
  lastClicked: null,

  // initialize
  init() {

    // get the container
    this.currContainer = Dom.currContainer();

    this.setCurrTrans();

    HistMgr.add(
      Utils.cleanHref(window.location.href),
      Dom.containerNamespace(this.currContainer)
    );

    // fire custom events for the current view.
    Dispatcher.trigger('stateChange', HistMgr.lastStatus());
    Dispatcher.trigger('newContainerLoad', HistMgr.lastStatus(), {}, this.currContainer);
    Dispatcher.trigger('transitionEnd', HistMgr.lastStatus());

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
});

// TODO: move following two functions to Util object
// log function for errors
const log = (console) ? console.log.bind(console) : function(){}

// load a new container
function loadNewContainer(url) {
  // TODO: move 'enabled' flag to Cache;
  // ...would simply cause Cache fns to noop
  return Promise
    .resolve(Cache.get(url) || Ajax.get(url))
    .then((response)=> { Cache.set(url, response); return response; })
    .then(Dom.parseNewContainer.bind(Dom), log);
}

// handle click; parse event
function handleClick(event) {
  // resolve the element
  let element = event.target; while (element && !element.href) { element = element.parentNode; }

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

// handle state change; receive clicked element
function handleStateChange(element) {
  // get new URL, after push-/popstate action
  const newUrl = Utils.cleanHref(window.location.href);
  // bail out, if this is the same as the one currently stored in history manager
  if (HistMgr.lastStatus().url === newUrl) return false;
  // create a promise for the new container
  const newContainerLoad = loadNewContainer(newUrl); // check

  // ...and deal with transition accordingly
  if (this.currTrans.progress() > 0) {
      // if in progress, recover the current transition and run 'intro' of new one
      // this.transitionRun.cancel();
      this.transitionRun = Promise
        .all([newContainerLoad, this.currTrans.recover()])
        // NB runIntro will receive container as first arg
        .then(this.setCurrTrans(newUrl).runIntro.bind(this.currTrans));
  } else {
      // ...otherwise run outro and intro of current
      this.transitionRun = Promise
        // NB reset previous transition, and set this.currTrans to new one, based on current link
        .all([newContainerLoad, this.setCurrTrans(newUrl).runOutro(this.currContainer, element)])
        // receive [newContainer, oldContainer], remove/append, return newContainer
        .then(Dom.swapContainers.bind(Dom))
        .then(this.currTrans.runIntro.bind(this.currTrans));
  }

  // fire internal events -- isn't the info loged on this line out of date?
  Dispatcher.trigger('stateChange', HistMgr.lastStatus(), HistMgr.prevStatus());

  // add URL to internal history manager
  HistMgr.add(newUrl);

  // update statuses when container is loaded
  newContainerLoad.then((container)=>{
    var lastStatus = HistMgr.lastStatus();
    lastStatus.namespace = Dom.containerNamespace(container);
    Dispatcher.trigger('newContainerLoad',
      HistMgr.lastStatus(),
      HistMgr.prevStatus(),
      container
    );
    this.currContainer = container;
    return true;
  }).catch(log);

  // fire transition end update
  this.transitionRun.then(()=>{
    Dispatcher.trigger('transitionEnd',
      HistMgr.lastStatus(),
      HistMgr.prevStatus()
    );
    return true;
  }).catch(log);
}

module.exports = Pjax;
