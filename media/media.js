// ___  ___         _ _
// |  \/  |        | (_)
// | .  . | ___  __| |_  __ _
// | |\/| |/ _ \/ _` | |/ _` |
// | |  | |  __/ (_| | | (_| |
// \_|  |_/\___|\__,_|_|\__,_|


require('../vendor/match-media'); // matchMedia polyfill
const Emitter = require('../event/emitter');
// TODO: find a way to check if CSS is actually loaded already
// TODO: use cssData here; make a function that returns cssMedium(key), which looks up cssData.media but falls back to cssData.base
const mediaEmitter = new Emitter();
const cssMedia = require('../utility/css-data').media;
const mediaKeys = Object.keys(cssMedia);
const breakPoints = mediaKeys.reduce((dest, key) => {
  dest[key] = cssMedia[key]['breakpoint'];
  return dest;
},{});

window.Media = module.exports = {

  mediaEmitter, breakPoints,

  keys: mediaKeys,
  currKey: undefined,
  // currKeyIndex: null,

  marginY(mult, key) {
    key = key || this.currKey;
    return parseInt(cssMedia[key]['margin-y']) * this.remPx(key);
  },

  marginX(mult, key) {
    key = key || this.currKey;
    return parseInt(cssMedia[key]['margin-x']) * this.remPx(key);
  },

  remPx(key) {
    key = key || this.currKey;
    return cssMedia[key]['html-scale'] * 16;
  },

  onChange(fn) { mediaEmitter.on('change', fn); },

  onEnter([lo, hi], fn, now=false) {},

  onExit([lo, hi], fn, now=false) {},

  onBelow(bp, fn, now=false) { mediaEmitter.on(`below-${bp}`, fn, now && !bpMatchers[bp].matches); },

  onAbove(bp, fn, now=false) { mediaEmitter.on(`above-${bp}`, fn, now && bpMatchers[bp].matches); }
};

// build up matchers
const bpMatchers = mediaKeys.reduce((dest, key) => {
  dest[key] = global.matchMedia(`(min-width: ${breakPoints[key]})`);
  return dest;
},{});

// build up handlers
const bpMatchHandlers = mediaKeys.reduce((dest, key, i, mediaKeys) => {
  dest[key] = (matcher) => {
    let dir = matcher.matches ? 'above' : 'below';
    mediaEmitter.trigger('change', {key, dir});
    mediaEmitter.trigger(`${dir}-${key}`);
    Media.currKey = matcher.matches ? key : mediaKeys[i - 1]; // should be undefined if below the smallest query
    // Media.currKeyIndex = matcher.matches ? i : i + 1;
  };
  return dest;
},{});

// set current key
Media.currKey = mediaKeys.filter((key) => { return bpMatchers[key].matches; }).reverse()[0];

// hook up the handlers to the matchers
mediaKeys.forEach((key) => { bpMatchers[key].addListener(bpMatchHandlers[key]); })
