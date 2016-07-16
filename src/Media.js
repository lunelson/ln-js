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

    // build breakPoints object
    const breakPoints = mediaKeys.reduce((obj, key) => {
      obj[key] = cssMedia[key][breakpoint];
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
        this.trigger('change');
        this.trigger(`enter-${query.matches ? mediaKeys[i + 1] : key}`);
        this.trigger(`exit-${query.matches ? key : mediaKeys[i + 1]}`);
      };
      return obj;
    },{});

    this.initialized = true;
    return this;
  },

  onChange(){},

  onBelow(){},

  onAbove(){},

  breakPoints(){},
});

module.exports = Media;