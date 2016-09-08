// ______          __     _       _
// | ___ \        / _|   | |     | |
// | |_/ / __ ___| |_ ___| |_ ___| |__
// |  __/ '__/ _ \  _/ _ \ __/ __| '_ \
// | |  | | |  __/ ||  __/ || (__| | | |
// \_|  |_|  \___|_| \___|\__\___|_| |_|

// NB this is separate from native prefetch/-load/-browse techniques
// https://css-tricks.com/prefetching-preloading-prebrowsing/

const Ajax = require('./ajax');
const Cache = require('./pjax2-cache');

function handleEnter(event) {
  if (!this.active) return;
  var target = event.target;
  if (target.dataset[this.dataAttr]!=undefined && target.href) {
    var url = target.href;
    Cache.set(url, Ajax.get(url));
  }
}

// TODO: add get/set methods for dataAttr, to strip the 'data-' part, if given
const Prefetch = module.exports = {
  dataAttr: 'prefetch',
  setDataAttr(str) { this.dataAttr = str; },
  init() {
    document.body.addEventListener('mouseover', handleEnter.bind(this));
    document.body.addEventListener('touchstart', handleEnter.bind(this));
  }
};
