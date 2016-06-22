var Ajax = require('./ajax');
var Utils = require('./pjax2-utils');
var Cache = require('./pjax2-cache');

function onLinkEnter(event) {
  // get event target
  var el = event.target;
  // traverse up until valid href
  while (el && !el.href) { el = el.parentNode; }
  // if nothing found, bail
  if (!el) { return; }
  // get the URL
  var url = el.href;
  // if link is valid...
  if (Utils.validLink(el, event)) {
    // get the content
    Promise
      .resolve(Cache.get(url)||Ajax.get(url))
      .then((response)=>Cache.set(url, response));
  }
}

/// PREFETCH
var Prefetch = module.exports = {
  init: function() {
    document.body.addEventListener('mouseover', onLinkEnter);
    document.body.addEventListener('touchstart', onLinkEnter);
  }
};
