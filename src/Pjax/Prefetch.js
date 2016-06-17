var Utils = require('../Utils');

var Pjax  = require('./Pjax');
var Cache = require('./Cache');

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
  if (Pjax.validLink(el, event) && !Cache.get(url)) {
    // get the content
    var xhr = Utils.xhr(url);
    // bung it in the cache
    Cache.set(url, xhr);
  }
}

/// PREFETCH
var Prefetch = module.exports = {
  init: function() {
    document.body.addEventListener('mouseover', onLinkEnter);
    document.body.addEventListener('touchstart', onLinkEnter);
  }
};
