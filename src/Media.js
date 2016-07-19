// ___  ___         _ _
// |  \/  |        | (_)
// | .  . | ___  __| |_  __ _
// | |\/| |/ _ \/ _` | |/ _` |
// | |  | |  __/ (_| | | (_| |
// \_|  |_/\___|\__,_|_|\__,_|

// NB add polyfill
require('../lib/match-media');
const Emitter = require('./emitter');
const emitter = new Emitter();
const cssMedia = require('./css-data').media;
const mediaKeys = Object.keys(cssMedia);

// build breakPoints object
const breakPoints = mediaKeys.reduce((obj, key) => {
  obj[key] = cssMedia[key]['breakpoint'];
  return obj;
},{});

// build bpMatchers object
const bpMatchers = mediaKeys.reduce((obj, key) => {
  obj[key] = global.matchMedia(`(min-width: ${breakPoints[key]})`);
  return obj;
},{});

// build bpMatchHandlers object
const bpMatchHandlers = mediaKeys.reduce((obj, key, i, mediaKeys) => {
  obj[key] = (matcher) => {
    let dir = matcher.matches ? 'above' : 'below';
    emitter.trigger('change', {key, dir});
  };
  return obj;
},{});

mediaKeys.forEach((key) => { bpMatchers[key].addListener(bpMatchHandlers[key]); })

emitter.on('change', ({key, dir}) => { emitter.trigger(`${dir}-${key}`); });

const Media = {

  emitter, breakPoints,

  keys: mediaKeys,

  currKey() { return mediaKeys.filter((key) => { return bpMatchers[key].matches; }).reverse()[0]; },

  currIndex() { return mediaKeys.indexOf(this.current()); },

  onChange(fn) { emitter.on('change', fn); },

  onBelow(bp, fn, now=false) { emitter.on(`below-${bp}`, fn, now && !bpMatchers[bp].matches); },

  onAbove(bp, fn, now=false) { emitter.on(`above-${bp}`, fn, now && bpMatchers[bp].matches); }
};

module.exports = Media;