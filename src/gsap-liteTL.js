require('gsap/src/uncompressed/TweenLite.js');
require('gsap/src/uncompressed/TimelineLite.js');
require('gsap/src/uncompressed/easing/EasePack.js');
require('gsap/src/uncompressed/plugins/CSSPlugin.js');
global.Tween = global.TweenMax || global.TweenLite || null;
global.Timeline = global.TimelineMax || global.TimelineLite || null;
