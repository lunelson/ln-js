/**
 * UTILITIES
 *
 */

const Util = {

  norm(value, [vmin, vmax]) {
    return (value - vmin) / (vmax - vmin);
  },

  lerp(ratio, [tmin, tmax]) {
    return (tmax - tmin) * ratio + tmin;
  },

  rmap(value, [vmin, vmax], [tmin, tmax]) {
    return lerp(norm(value, vmin, vmax), tmin, tmax);
  },

  clamp(value, [tmin, tmax]) {
    return Math.min(Math.max(value, tmin), tmax);
  },

  sum(...nums) { return nums.reduce((prev, curr) => prev + curr); },

  average(...nums) { return Util.sum(...nums) / nums.length; },

  random(min, max) {
    if (!max) { max = min; min = 0; }
    return min + Math.random() * (max - min);
  },

  randomInt(min, max, inc = false) {
    if (typeof max !== 'number') { inc = max; max = min; min = 0; }
    return Math.floor(min + Math.random() * (max + (inc ? 1 : 0) - min));
  },

  randomDistro(min, max, i = 3) {
    if (arguments.length < 2) { max = min; min = 0; }
    // var randoms = new Array(i).fill(0).map(()=> Util.random(min, max));
    var randoms = Util.times(i, () => Util.random(min, max));
    return Util.average(...randoms);
  },

  randomBiased(min, max) {},

  deg2Rad(deg) { return deg / 180 * Math.PI; },
  rad2Deg(rad) { return rad * 180 / Math.PI; },
  sinD(deg) { return Math.sin(deg2rad(deg)); },
  cosD(deg) { return Math.cos(deg2rad(deg)); },
  tanD(deg) { return Math.tan(deg2rad(deg)); },
  asinD(num) { return rad2deg(Math.asin(num)); },
  acosD(num) { return rad2deg(Math.acos(num)); },
  atanD(num) { return rad2deg(Math.atan(num)); },

  pDistance(p1, p2) {
    var [x1, y1] = Array.isArray(p1) ? p1 : [p1.x, p1.y];
    var [x2, y2] = Array.isArray(p2) ? p2 : [p2.x, p2.y];
    return Math.hypot(x2 - x1, y2 - y1);
  },

  roundToMult(num, mult) {
    return Math.round(num / mult) * mult;
  },

  roundToDec(num, dec) {
    return Util.roundToMult(num, Math.pow(10, dec/-1));
  },

  times(n, fn) {
    // return new Array(n).fill(null).map((v, i) => fn(i));
    const result = [];
    for (let i = 0; i < n; i++) { result.push(fn(i)); }
    return result;
  },

  emptyObj(obj) {
    var key;
    for (key in obj) { return false; }
    return true;
  },

  empty(item) {
    if (typeof(item) === 'object') {
      var key; for (key in item) { return false; }
      return true;
    } else {
      return false;
    }
  },

}


// console.log(norm(5, [1, 7]));
// console.log(norm(5, [7, 1]));

// console.log(lerp(0.25, [20, 80]));
// console.log(lerp(0.25, [200, 80]));

// console.log(rmap(25, [10, 90], [300, 700]));

module.exports = Util;