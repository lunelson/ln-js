function nullifyXY() { this._x = null; this._y = null; }
function nullifyV() { this._rad = null; this._len = null; }

class Vector {

  constructor(x=0, y=0) {
    if (typeof x === 'object') { this.v = x; }
    else { this.xy = [x,y]; }
  }

  get x() { this._x = this._x || Math.cos(this.rad) * this.len; return this._x; }
  get y() { this._y = this._y || Math.sin(this.rad) * this.len; return this._y; }
  get rad() { this._rad = this._rad || Math.atan2(this.y, this.x); return this._rad; }
  get len() { this._len = this._len || Math.hypot(this.y, this.x); return this._len; }

  set x(x) { this._x = x; nullifyV.call(this); }
  set y(y) { this._y = y; nullifyV.call(this); }
  set rad(rad) { this._rad = rad; nullifyXY.call(this); }
  set len(len) {
    if (this._len) {
      this._x = this.x / this._len * len;
      this._y = this.y / this._len * len;
    } else { nullifyXY.call(this); }
    this._len = len;
  }

  get xy() { let {x, y} = this; return [x, y]; }
  get v() { let {len, rad} = this; return {len, rad}; }
  set xy([x, y]){ this.x = x; this.y = y;  }
  set v({len, rad}) { this.len = len; this.rad = rad; }

  add(v) { this._x = this.x + v.x; this._y = this.y + v.y; nullifyV.call(this); }
  sub(v) { this._x = this.x - v.x; this._y = this.y - v.y; nullifyV.call(this); }
  mult(n) {
    this._x = this.x * n;
    this._y = this.y * n;
    this._len = this.len * n;
  }
  normalize() {
    if (this._len) {
      this._x = this.x / this._len;
      this._y = this.y / this._len;
    } else { nullifyXY.call(this); }
    this._len = 1;
  }
  clone() { return new Vector(this.x, this.y); }


  // alias get/set
  get mag() { return this.len; }
  get dir() { return this.rad; }
  get deg() { return this.rad * 180 / Math.PI; }
  set mag(mag) { this.len = mag; }
  set dir(dir) { this.rad = dir; }
  set deg(deg) { this.rad = deg / 180 * Math.PI; }

  // static methods
  static add(v1, v2) { return new Vector(v1.x + v2.x, v1.y + v2.y) }
  static sub(v1, v2) { return new Vector(v1.x - v2.x, v1.y - v2.y) }
  static mult(v, n) { return new Vector(v.x * n, v.y * n) }
  static clone(v) { return new Vector(v.x, v.y); }
  static create(...args) { return new Vector(...args); }

}

module.exports = Vector;