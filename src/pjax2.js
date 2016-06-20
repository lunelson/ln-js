// Promise polyfill https://github.com/taylorhakes/promise-polyfill
// alternative -- https://github.com/getify/native-promise-only
if (typeof Promise !== 'function') { window.Promise = require('native-promise-only'); }

// general
const Dispatcher   = require('./dispatcher');

// pjax specific stuff
const Cache        = require('./pjax2/cache');
const Dom          = require('./pjax2/dom');
const History      = require('./pjax2/history');
const Prefetch     = require('./pjax2/prefetch');
const Transition   = require('./pjax2/transition');
const View         = require('./pjax2/view');
const Utils        = require('./pjax2/utils');

const defaultTransition =  require('./pjax2/hideshowtransition');

// log function for errors
const log = (console) ? console.log.bind(console) : function(){}

// get current URL
function currentUrl() { return Utils.cleanLink( Utils.currentUrl() ); }

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
    handleStateChange();
  }
}

// stateChange handler
function handleStateChange() {

  // get new URL, after push-/popstate action
  var newUrl = currentUrl();

  // bail out, if this is the same as the one currently stored in history manager
  if (HistMgr.currStatus().url === newUrl) return false;

  // whatever the state of current load, we can re-assign it
  this.newContainerLoad.cancel();
  this.newContainerLoad = this.loadNewContainer(newUrl);

  // ...and deal with transition accordingly
  if (this.currTrans.progress < 1) {
      // if in progress, recover the current transition and run 'intro' of new one
      this.transitionRun.cancel();
      this.transitionRun = Promise
        .all(this.newContainerLoad, this.currTrans.recover())
        // NB doIntro will receive container as first arg
        .then(this.setCurrTrans(newUrl).doIntro);
  } else {
      // ...otherwise run outro and intro of current
      this.transitionRun = Promise
        // NB reset previous transition, and set this.currTrans to new one, based on current link
        .all(this.newContainerLoad, this.setCurrTrans(newUrl).doOutro(el))
        // NB doIntro will receive container as first arg
        .then(this.currTrans.doIntro);
  }

  // fire internal events -- isn't the info loged on this line out of date?
  Dispatcher.trigger('stateChange', HistMgr.currStatus(), HistMgr.prevStatus());

  // add URL to internal history manager
  HistMgr.add(newUrl);

  // update statuses when container is loaded
  this.newContainerLoad.then((container)=>{
    var currStatus = HistMgr.currStatus();
    currStatus.namespace = Dom.getNamespace(container);
    Dispatcher.trigger('newContainerLoad',
      HistMgr.currStatus(),
      HistMgr.prevStatus(),
      container
    );
    return true;
  }).catch(log).done();

  // fire transition end update
  this.transitionRun.then(()=>{
    Dispatcher.trigger('transitionEnd',
      HistMgr.currStatus(),
      HistMgr.prevStatus()
    );
    return true;
  }).catch(log).done();
}

// PJAX
var Pjax = module.exports = {
  newContainerLoad: Promise.resolve(Dom.getContainer()),
  currTrans: null,
  setCurrTrans(url) {
    // reset this.currTrans
    // determine a new one, based on incoming URL
    return this.currTrans = defaultTransition;
  },

  // whether to use cache
  cacheEnabled: true,

  // initialize
  init: function() {

    // get the container
    var container = Dom.getContainer();

    HistMgr.add(
      currentUrl(),
      Dom.getNamespace(container)
    );

    // fire custom events for the current view.
    Dispatcher.trigger('stateChange', HistMgr.currStatus());
    Dispatcher.trigger('newContainerLoad', HistMgr.currStatus(), {}, container);
    Dispatcher.trigger('transitionEnd', HistMgr.currStatus());

    // bind native events
    document.addEventListener('click', handleClick.bind(this));
    window.addEventListener('popstate', handleStateChange.bind(this));
  },

  // load a new page; return Promise
  loadNewContainer: function(url) {
    // TODO: make better conditional logic here, wrt cacheEnabled flag
    var gotHTML = Cache.get(url) || Utils.getHTML(url);
    return Promise.resolve(gotHTML).then((html) => {
      Cache.set(url, html);
      var container = Dom.parseResponse(html);
      Dom.putContainer(container);
      if (!Pjax.cacheEnabled) Cache.reset();
    }, (error) => {
        console.log(error);
        window.location = url;
    });
  },

  // exposure of other objects
  Cache: Cache,
  Dom: Dom,
  History: History,
  Prefetch: Prefetch,
  Transition: Transition,
  Utils: Utils,
  View: View
};
