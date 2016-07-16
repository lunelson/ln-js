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
    if (this.initialized) throw new Error('Pjax: attempted to initialize twice');
    this.cssMedia = cssMedia;

    console.log(this.cssMedia);
    Object.keys(this.cssMedia).forEach((mKey)=>{
      console.log(this.cssMedia[mKey].breakpoint);
    })

    this.initialized = true;
    return this;
  },

  onChange(){},

  onBelow(){},

  onAbove(){},

  breakPoints(){},
});

module.exports = Media;