// transition / animation

  var transEnd, animEnd, t, a;

  var el = document.createElement('test');

  var transitions = {
    'transition':'transitionend',
    'OTransition':'oTransitionEnd',
    'MozTransition':'transitionend',
    'WebkitTransition':'webkitTransitionEnd'
  };

  var animations = {
    'animation':'animationend',
    'OAnimation':'oAnimationEnd',
    'MozAnimation':'animationend',
    'WebkitAnimation':'webkitAnimationEnd'
  };

  for (t in transitions) { if( el.style[t] !== undefined ) { transEnd = transitions[t]; break; } }
  for (a in animations) { if( el.style[a] !== undefined ) { animEnd = animations[a]; break; } }

module.exports = { transEnd, animEnd };