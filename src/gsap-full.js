require('gsap/src/uncompressed/TweenMax.js');
global.Tween = global.TweenMax || global.TweenLite || null;
global.Timeline = global.TimelineMax || global.TimelineLite || null;
