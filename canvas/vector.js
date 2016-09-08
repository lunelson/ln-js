Math.hypot = Math.hypot || function(a, b) { return Math.sqrt(Math.pow(a,2) + Math.pow(b, 2)); }

/*
  SYNC
  this._sync = {xy: true, vec: false}

 */

class Vector {

  constructor(x=0, y=0) {
    if (typeof x === 'object') { this.v = x; }
    else { this.xy = [x,y]; }
  }

  set xy([x, y]){ this._x = x; this._y = y; this._xySync = true; }
  set x(x) { this.x = x; this._vSync = false; }
  set y(y) { this.y = y; this._vSync = false; }

  set vec({len, mag, rad, deg, dir}) {
    // aliases
    if (typeof mag == 'number') { len = mag; }
    if (typeof deg == 'number') { dir = deg / 180 * Math.PI; }
    if (typeof rad == 'number') { dir = rad; }
    // setting
    if (typeof len == 'number') { this.mag = len; }
    if (!this._len) { this.mag = 0; }
    if (typeof dir == 'number') { this.dir = dir%(Math.PI*2); }
    if (!this._rad) { this.dir = 0; }
  }

  _syncV() {
    this._len = Math.hypot(this.y, this.x);
    this._rad = Math.atan2(this.y, this.x);
    this._vSync = true;
  }

  _syncXY() {
    this._x = Math.cos(this.dir) * this.mag;
    this._y = Math.sin(this.dir) * this.mag;
    this._xySync = true;
  }

  /// THESE OPS THROW VEC OUT OF SYNC
  add(v) { this._x = this.x + v.x; this._y = this.y + v.y; this._vSync = false; }
  sub(v) { this._x = this.x - v.x; this._y = this.y - v.y; this._vSync = false; }

  /// THESE OPS THROW XY OUT OF SYNC
  set dir(rad) { this._rad = rad; this._xySync = false; }
  set rad(rad) { this._rad = rad; this._xySync = false; }
  set deg(deg) { this._rad = deg / 180 * Math.PI; this._xySync = false; }

  /// THESE OPS REQUIRE CHECKING BOTH SYNC PROPS
  mult(n) {
    this._len *= n;
    this._x *= n;
    this._y *= n;
    if (!this._rad) this._syncV();

  }
  normalize() {
    if (!this._vSync) this._syncV();
    this._len /= this._len;
    this._x /= this._len;
    this._y /= this._len;
  }
  set mag(len) {
    if (!this._len) { this._len = len; this.sync.xy = false; }
    else if (!this._vSync) {
      this._syncV();
      this._len *= len/this._len;
      this._x *= len/this._len;
      this._y *= len/this._len;
    }
  }
  set len(len) {
    if (!this._vSync) this._syncV();
    this._len *= len/this._len;
    this._x *= len/this._len;
    this._y *= len/this._len;
  }

  /// THESE OPS REQUIRE CHECKING RESPECTIVE SYNC PROPS
  get x() { if (!this._xySync) this._syncXY(); return this._x; }
  get y() { if (!this._xySync) this._syncXY(); return this._y; }
  get xy() { if (!this._xySync) this._syncXY(); return [this._x, this._y]; }
  get len() { if (!this._vSync) this._syncV(); return this._len; }
  get mag() { if (!this._vSync) this._syncV(); return this._len; }
  get rad() { if (!this._vSync) this._syncV(); return this._rad; }
  get deg() { if (!this._vSync) this._syncV(); return this._rad * 180 / Math.PI; }
  get vec() { if (!this._vSync) this._syncV(); return {len: this._len, mag: this._len, rad: this._rad, dir: this._rad, deg: this.deg}; }

  reflect(norm, rate=1) {
    var opp = (this._rad + Math.PI) % (Math.PI*2);
    var len = Math.sin(Math.abs(norm - Math.PI/2 - opp)) * this._len * (rate + 1);
    this.add(new Vector({rad: norm, len: len}));
  }

  // class methods
  static add(v1, v2) { return new Vector(v1.x + v2.x, v1.y + v2.y) }
  static sum(v1, v2) { return new Vector(v1.x + v2.x, v1.y + v2.y) }
  static sub(v1, v2) { return new Vector(v1.x - v2.x, v1.y - v2.y) }
  static diff(v1, v2) { return new Vector(v1.x - v2.x, v1.y - v2.y) }
  static mult(v, n) { return new Vector(v.x * n, v.y * n) }
  static scale(v, n) { return new Vector(v.x * n, v.y * n) }
  static create(...args) { return new Vector(...args); }
}

module.exports = Vector;