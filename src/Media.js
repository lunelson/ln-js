// ___  ___         _ _
// |  \/  |        | (_)
// | .  . | ___  __| |_  __ _
// | |\/| |/ _ \/ _` | |/ _` |
// | |  | |  __/ (_| | | (_| |
// \_|  |_/\___|\__,_|_|\__,_|

const Emitter = require('./emitter');
const cssMedia = require('./css-data').media;

const Media = Object.assign(new Emitter(), {

  init() {

    // init check
    if (this.initialized) throw new Error('Pjax: attempted to initialize twice');

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
        // let prev, curr;
        // if (matcher.matches) { curr = mediaKeys[i+1]; prev = key; }
        // else { prev = mediaKeys[i+1]; curr = key; }
        // this.trigger('change', prev, curr);
        let dir = matcher.matches ? 'above' : 'below';
        this.trigger('change', dir, key);
      };
      return obj;
    },{});

    mediaKeys.forEach((key)=>{
      bpMatchers[key].addListener(bpMatchHandlers[key]);
    })

    this.cssMedia = cssMedia;

    this.on('change', (dir, key) => { this.trigger(`${dir}-${key}`); });

    // this.on('change', (prev, curr) => {
    //   let prevIndex = mediaKeys.indexOf(prev);
    //   let currIndex = mediaKeys.indexOf(curr);
    //   if (prevIndex < currIndex) {
    //     console.log(obj);
    //   } else {

    //   }
    // });

    this.initialized = true;
    return this;
  },

  // isAbove(lo) { return  bpMatchers[lo].matches; },
  // isBelow(hi) { return !bpMatchers[hi].matches; },
  // isBetween(lo, hi) {
  //   if (mediaKeys.indexOf(hi) < mediaKeys.indexOf(lo)) [lo, hi] = [hi, lo];
  //   return bpMatchers[lo].matches && !bpMatchers[hi].matches;
  // },

  // onChange(fn) {},
  // onAbove('c3', fn) {},
  // onBelow('c3', fn) {},
  // onBetween('c4', 'c8', fn), {}


  onChange(fn){
    this.on('change', fn);
  },

  onBelow(bp, fn, now=false){
    if (now && !bpMatchers[bp].matches) fn();
  },

  onAbove(bp, fn, now=false){
    if (now && bpMatchers[bp].matches) fn();

  },

  // breakPoints: breakPoints,
});

module.exports = Media;