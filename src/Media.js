// ___  ___         _ _
// |  \/  |        | (_)
// | .  . | ___  __| |_  __ _
// | |\/| |/ _ \/ _` | |/ _` |
// | |  | |  __/ (_| | | (_| |
// \_|  |_/\___|\__,_|_|\__,_|

const Emitter = require('./emitter');
const Media = Object.assign(new Emitter(), {

  init() {
    if (this.initialized) throw new Error('Pjax: attempted to initialize twice');
    this.initialized = true;
    // parse the CSS
    return this;
  },

  onChange(){},

  onBelow(){},

  onAbove(){},

  breakPoints(){},
});

module.exports = Media;