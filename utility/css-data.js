//                         _       _
//                        | |     | |
//   ___ ___ ___ ______ __| | __ _| |_ __ _
//  / __/ __/ __|______/ _` |/ _` | __/ _` |
// | (__\__ \__ \     | (_| | (_| | || (_| |
//  \___|___/___/      \__,_|\__,_|\__\__,_|

// TODO: integration or check wrt if CSS is loaded, or wrt async CSS loading

// regex to deal with how browsers pass JSON strings through CSS
function cleanCSSData(string) {
  if (typeof string === 'string' || string instanceof String) {
    string = string.replace(/^['"]+|\s+|\\|(;\s?})+|['"]$/g, ''); }
  return string;
}

// fallback to get css prop value from element (head font-family)
function getElementCSSPropValue(el, prop) {
  var re = /(\-([a-z]){1})/g;
  if (re.test(prop)) {
    prop = prop.replace(re, function () {
      return arguments[2].toUpperCase();
    });
  }
  return el.currentStyle[prop] ? el.currentStyle[prop] : null;
};

// main function to retrieve JSON data from CSS
function getCSSData() {
  var style = null;
  if (window.getComputedStyle && window.getComputedStyle(document.body, '::before')) {
    style = window.getComputedStyle(document.body, '::before').content;
  } else {
    style = getElementCSSPropValue(document.getElementsByTagName('head')[0], 'font-family');
  }
  return JSON.parse(cleanCSSData(style));
}

module.exports = getCSSData();