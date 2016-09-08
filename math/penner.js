/**
 * Robert Penner equations ported to JS
 * http://robertpenner.com/easing/
 */
module.exports = {

  linear(time, start, delta, duration) {
    var progress = time / duration;
    return delta * progress + start;
  },

  easeInQuad(time, start, delta, duration) {
    return delta * (time /= duration) * time + start;
  },

  easeOutQuad(time, start, delta, duration) {
    return -delta * (time /= duration) * (time - 2) + start;
  },

  easeInOutQuad(time, start, delta, duration) {
    if ((time /= duration / 2) < 1) { return delta / 2 * time * time + start; }
    return -delta / 2 * ((--time) * (time - 2) - 1) + start;
  },

  easeInCubic(time, start, delta, duration) {
    var progress = time / duration;
    return delta * Math.pow(progress, 3) + start;
  },

  easeOutCubic(time, start, delta, duration) {
    var progress = time / duration;
    return delta * (Math.pow(progress - 1, 3) + 1) + start;
  },

  easeInOutCubic(time, start, delta, duration) {
    if ((time /= duration / 2) < 1) { return delta / 2 * Math.pow(time, 3) + start; }
    return delta / 2 * (Math.pow(time - 2, 3) + 2) + start;
  },

  easeInQuart(time, start, delta, duration) {
    var progress = time / duration;
    return delta * Math.pow (progress, 4) + start;
  },

  easeOutQuart(time, start, delta, duration) {
    var progress = time / duration;
    return -delta * (Math.pow(progress - 1, 4) - 1) + start;
  },

  easeInOutQuart(time, start, delta, duration) {
      if ((time /= duration / 2) < 1) { return delta / 2 * Math.pow(time, 4) + start; }
      return -delta/2 * (Math.pow(time - 2, 4) - 2) + start;
  },

  easeInQuint(time, start, delta, duration) {
    var progress = time / duration;
    return delta * Math.pow (progress, 5) + start;
  },

  easeOutQuint(time, start, delta, duration) {
    var progress = time / duration;
    return delta * (Math.pow(progress - 1, 5) + 1) + start;
  },

  easeInOutQuint(time, start, delta, duration) {
    if ((time /= duration / 2) < 1) { return delta / 2 * Math.pow(time, 5) + start; }
    return delta / 2 * (Math.pow(time - 2, 5) + 2) + start;
  },

  easeInSine(time, start, delta, duration) {
    var progress = time / duration;
    return delta * (1 - Math.cos(progress * (Math.PI / 2))) + start;
  },

  easeOutSine(time, start, delta, duration) {
    var progress = time / duration;
    return delta * Math.sin(progress * (Math.PI / 2)) + start;
  },

  easeInOutSine(time, start, delta, duration) {
    var progress = time / duration;
    return delta / 2 * (1 - Math.cos(Math.PI * progress)) + start;
  },

  easeInExpo(time, start, delta, duration) {
    var progress = time / duration;
    return delta * Math.pow(2, 10 * (progress - 1)) + start;
  },

  easeOutExpo(time, start, delta, duration) {
    var progress = time / duration;
    return delta * (-Math.pow(2, -10 * progress) + 1) + start;
  },

  easeInOutExpo(time, start, delta, duration) {
    if ((time /= duration / 2) < 1) { return delta / 2 * Math.pow(2, 10 * (time - 1)) + start; }
    return delta / 2 * (-Math.pow(2, -10 * --time) + 2) + start;
  },

  easeInCirc(time, start, delta, duration) {
    return delta * (1 - Math.sqrt(1 - (time /= duration) * time)) + start;
  },

  easeOutCirc(time, start, delta, duration) {
    var progress = time / duration;
    return delta * Math.sqrt(1 - (time = progress - 1) * time) + start;
  },

  easeInOutCirc(time, start, delta, duration) {
    if ((time /= duration / 2) < 1) { return delta / 2 * (1 - Math.sqrt(1 - time * time)) + start; }
    return delta / 2 * (Math.sqrt(1 - (time -= 2) * time) + 1) + start;
  },
};

