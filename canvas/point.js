/*
  NEW
  distanceTo(Point||Particle)
  angleTo(Point||Particle)
 */
class Point {
  constructor(x=0, y=0) { this.x = x; this.y = y; }

  get xy() { return [this.x, this.y]; }
  set xy([x, y]) {
    if (typeof x == 'number') this.x = x;
    if (typeof y == 'number') this.y = y;
  }

  distanceTo(p) {}
  angleTo(p) {}

  static sum(p1, p2) { return new Point(p1.x + p2.x, p1.y + p2.y) }
  static diff(p1, p2) { return new Point(p1.x - p2.x, p1.y - p2.y) }
  static create(...args) { return new Point(...args); }
}

module.exports = Point;