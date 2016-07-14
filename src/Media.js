// ___  ___         _ _
// |  \/  |        | (_)
// | .  . | ___  __| |_  __ _
// | |\/| |/ _ \/ _` | |/ _` |
// | |  | |  __/ (_| | | (_| |
// \_|  |_/\___|\__,_|_|\__,_|

const Emitter = require('./emitter');

// some craxy regex to deal with how browsers pass the JSON through CSS
function cleanCSSData(string) {
  if (typeof string === 'string' || string instanceof String) {
    string = string.replace(/^['"]+|\s+|\\|(;\s?})+|['"]$/g, ''); }
  return string;
}

// fallback to get css prop value from element
function getElementCSSPropValue(el, prop) {
  var re = /(\-([a-z]){1})/g;
  if (re.test(prop)) {
    prop = prop.replace(re, function () {
      return arguments[2].toUpperCase();
    });
  }
  return el.currentStyle[prop] ? el.currentStyle[prop] : null;
};

// get the breakpoint labels from the body's css generated content
function getCSSData() {
  var style = null;
  if (window.getComputedStyle && window.getComputedStyle(document.body, '::before')) {
    style = window.getComputedStyle(document.body, '::before').content;
  } else {
    style = getElementCSSPropValue(document.getElementsByTagName('head')[0], 'font-family');
  }
  return JSON.parse(cleanCSSData(style));
}


const Media = Object.assign(new Emitter(), {

  init() {
    if (this.initialized) throw new Error('Pjax: attempted to initialize twice');
    var cssData = getCSSData();
    this.cssMedia = cssData.media;
    this.cssGlobals = cssData.globals;

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