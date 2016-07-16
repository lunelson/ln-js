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

    // build breakPointEvents object
    const breakPointEvents = mediaKeys.reduce((obj, key) => {
      obj[key] = global.matchMedia(`(min-width: ${breakPoints[key]})`);
      return obj;
    },{});

    // build breakPointHandlers object
    const breakPointHandlers = mediaKeys.reduce((obj, key, i, mediaKeys) => {
      obj[key] = (query) => {
        let curr, prev;
        if (query.matches) { curr = mediaKeys[i+1]; prev = key; }
        else { prev = mediaKeys[i+1]; curr = key; }
        this.trigger('change', prev, curr);
      };
      return obj;
    },{});

    mediaKeys.forEach((key)=>{
      breakPointEvents[key].addListener(breakPointHandlers[key]);
    })

    this.cssMedia = cssMedia;
    this.initialized = true;
    return this;
  },

  onChange(){},

  onBelow(){},

  onAbove(){},

  breakPoints(){},
});

module.exports = Media;