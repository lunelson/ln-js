/// Promise polyfill https://github.com/taylorhakes/promise-polyfill
/// alternative -- https://github.com/getify/native-promise-only
if (typeof Promise !== 'function') { window.Promise = require('native-promise-only'); }

// general
var Dispatcher        = require('./dispatcher');

// pjax specific stuff
var Cache      = require('./pjax/cache');
var Dom        = require('./pjax/dom');
var History    = require('./pjax/history');
var Prefetch   = require('./pjax/prefetch');
var Transition = require('./pjax/transition');
var View       = require('./pjax/view');
var Utils      = require('./pjax/utils');


/// get current URL
function getCurrentUrl() { return Utils.cleanLink( Utils.getCurrentUrl() ); }

// TODO: rename the following two functions
/// go to
// function goTo(url) {
//   window.history.pushState(null, null, url);
//   onStateChange();
// }
/// force go to
function forceGoTo(url) { window.location = url; }

/// linkClick handler
function onLinkClick(event) {
  // resolve the element
  var element = event.target;
  while (element && !element.href) { element = element.parentNode; }
  // check if element is valid
  if (Utils.validLink(element, event)) {
    event.stopPropagation();
    event.preventDefault();
    // fire and update
    Dispatcher.trigger('linkClick', element);
    window.history.pushState(null, null, element.href);
    onStateChange();
  }
}

/// stateChange handler
function onStateChange() {

  console.log(History.lastStatus());

  // get new URL
  var newUrl = getCurrentUrl();
  // bail out, if current URL is same as new URL
  if (History.lastStatus().url === newUrl) return false;
  // check if transition in progress
  if (Pjax.transitionInProgress) {
    /// if trans in prog, force go to new URL
    /// NB. this is where we'd have to cancel the current transition and start another one
    forceGoTo(newUrl);
  }
  // otherwise...
  // fire internal events
  Dispatcher.trigger('stateChange', History.lastStatus(), History.prevStatus());
  // add URL to internal history manager
  History.add(newUrl);
  // get the promise for the new container
  var gotContainer = Pjax.load(newUrl);
  // this should not at all be necessary
  var transition = Object.create(Pjax.getTransition());
  Pjax.transitionInProgress = true;
  var transitionInstance = transition.init(
    Dom.getContainer(),
    gotContainer
  );
  gotContainer.then( onContainerLoad );
  transitionInstance.then( onTransitionEnd );
}

/// containerLoad handler
function onContainerLoad(container) {
  var lastStatus = History.lastStatus();
  lastStatus.namespace = Dom.getNamespace(container);
  Dispatcher.trigger('containerLoad',
    History.lastStatus(),
    History.prevStatus(),
    container
  );
}

/// transitionEnd handler
function onTransitionEnd() {
  Pjax.transitionInProgress = false;
  Dispatcher.trigger('transitionEnd',
    History.lastStatus(),
    History.prevStatus()
  );
}

/// PJAX
var Pjax = module.exports = {

  /// whether to use cache
  cacheEnabled: true,

  /// whether transition is in progress
  transitionInProgress: false,

  /// what transition to use
  /// * either change this...
  defaultTransition: require('./Pjax/HideShowTransition'),
  /// ...or change this, to affect defaults
  getTransition: function() { return this.defaultTransition; },

  /// initialize
  init: function() {

    // get the container
    var container = Dom.getContainer();

    History.add(
      getCurrentUrl(),
      Dom.getNamespace(container)
    );

    // fire custom events for the current view.
    Dispatcher.trigger('stateChange', History.lastStatus());
    Dispatcher.trigger('containerLoad', History.lastStatus(), {}, container);
    Dispatcher.trigger('transitionEnd', History.lastStatus());

    // bind native events
    document.addEventListener('click', onLinkClick);
    window.addEventListener('popstate', onStateChange);
  },

  /// load a new page; return Promise
  load: function(url) {
    var deferred = Utils.deferred();
    var xhr = Cache.get(url);
    if (!xhr) {
      xhr = Utils.xhr(url);
      Cache.set(url, xhr);
    }
    xhr.then(
      // success
      function(data) {
        var container = Dom.parseResponse(data);
        Dom.putContainer(container);
        if (!Pjax.cacheEnabled) Cache.reset();
        deferred.resolve(container);
      },
      // error
      function() {
        window.location = url;
        deferred.reject();
      }
    );
    return deferred.promise;
  },

  /// exposure of other objects
  Cache: Cache,
  Dom: Dom,
  History: History,
  Prefetch: Prefetch,
  Transition: Transition,
  Utils: Utils,
  View: View
};
