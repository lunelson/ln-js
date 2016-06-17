/// Promise polyfill https://github.com/taylorhakes/promise-polyfill
/// alternative -- https://github.com/getify/native-promise-only
if (typeof Promise !== 'function') { window.Promise = require('promise-polyfill'); }

// general
var Dispatcher        = require('../Dispatcher');
var Utils             = require('../Utils');

// pjax specific stuff
var Cache      = require('./Cache');
var Dom        = require('./Dom');
var History    = require('./History');
var Prefetch   = require('./Prefetch');
var Transition = require('./Transition');
var View       = require('./View');


/// get current URL
function getCurrentUrl() { return Utils.cleanLink( Utils.getCurrentUrl() ); }

// TODO: rename the following two functions
/// go to
function goTo(url) {
  window.history.pushState(null, null, url);
  onStateChange();
}
/// force go to
function forceGoTo(url) { window.location = url; }

/// linkClick handler
function onLinkClick(event) {
  var element = event.target;
  // traverse up nodeList to first link w href
  while (element && !element.href) { element = element.parentNode; }
  if (Pjax.validLink(element, event)) {
    event.stopPropagation();
    event.preventDefault();
    Dispatcher.trigger('linkClick', element);
    goTo(element.href);
  }
}

/// stateChange handler
function onStateChange() {
  // get new URL
  var newUrl = getCurrentUrl();
  // if trans in prog, force go to new URL
  if (this.transitionInProgress) forceGoTo(newUrl);
  // bail out, if current URL is same as new URL
  if (History.currentStatus().url === newUrl) return false;
  // otherwise....
  History.add(newUrl);
  var newContainer = this.load(newUrl);
  var transition = Object.create(this.getTransition());
  this.transitionInProgress = true;
  Dispatcher.trigger('stateChange',
    History.currentStatus(),
    History.prevStatus()
  );
  var transitionInstance = transition.init(
    Dom.getContainer(),
    newContainer
  );
  newContainer.then( this.onContainerLoad.bind(this) );
  transitionInstance.then( this.onTransitionEnd.bind(this) );
}

/// containerLoad handler
function onContainerLoad(container) {
  var currentStatus = History.currentStatus();
  currentStatus.namespace = Dom.getNamespace(container);
  Dispatcher.trigger('newPageReady',
    History.currentStatus(),
    History.prevStatus(),
    container
  );
}

/// transitionEnd handler
function onTransitionEnd() {
  Pjax.transitionInProgress = false;
  Dispatcher.trigger('transitionEnd',
    History.currentStatus(),
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
  defaultTransition: require('./HideShowTransition'),
  /// ...or change this, to affect defaults
  getTransition: function() { return this.defaultTransition; },

  /// whether a link should be followed
  validLink: function(element, event) {
    if (!history.pushState) return false;
    /// user
    if (!element || !element.href) return false;
    /// middle click, cmd click, and ctrl click
    if (event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    /// ignore target with _blank target
    if (element.target && element.target === '_blank') return false;
    /// check if it's the same domain
    if (window.location.protocol !== element.protocol || window.location.hostname !== element.hostname) return false;
    /// check if the port is the same
    if (Utils.getPort() !== Utils.getPort(element.port)) return false;
    /// ignore case when a hash is being tacked on the current url
    if (element.href.indexOf('#') > -1) return false;
    /// in case you're trying to load the same page
    if (Utils.cleanLink(element.href) == Utils.cleanLink(location.href)) return false;
    if (element.classList.contains('no-barba')) return false;
    return true;
  },

  /// initialize
  init: function() {

    // get the container
    var container = Dom.getContainer();

    History.add(
      getCurrentUrl(),
      Dom.getNamespace(container)
    );

    // fire custom events for the current view.
    Dispatcher.trigger('stateChange', History.currentStatus());
    Dispatcher.trigger('newPageReady', History.currentStatus(), {}, container);
    Dispatcher.trigger('transitionEnd', History.currentStatus());

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
        forceGoTo(url);
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
  View: View
};
