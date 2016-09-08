/**
 * PARTICLE 2D
 *
 */

/* NEW
  - add a context argument to constructor ?
  - would enable Particle to also draw itself, as part of update !
*/
var Vector = require('./vector2');
var Point = require('./point');

class Particle extends Point {
  constructor(x=0, y=0, v={len: 0, rad: 0}) {
    super(x, y);
    this.velocity = new Vector(v);
    this.friction = 0.1;
    this.mass = 0; //???
    this.magnetism = 0;
    this.springs = [];
    this.magnets = [];
    this.gravities = [];
    this.radius = 0;
    this.color = '#000';
  }

  isOffScreen(context) {}
  isOffTop(context) {}
  isOffRight(context) {}
  isOffBottom(context) {}
  isOffLeft(context) {}

  addSpring(p) {}
  addMagnet(p) {}
  addGravity(p) {}

  update(...vectors) {
    // let n = springs.length; while (n--) {
    //   spring = springs[n];
    // } n = magnets.length; while (n--) {
    //   magnet = magnets[n];
    // } n = gravities.length; while (n--) {
    //   gravitie = gravities[n];
    // } n = vectors.length; while (n--) {
    //   vector = vectors[n];
    // } this.velocity._updateVec();
    // if (this.velocity._len) {
    //   this.velocity._len = Math.max(0, this.velocity._len - this.friction);
    //   this.velocity._updateXY();
    // }
    this.springs.forEach((spring) => {});
    this.magnets.forEach((magnet) => {});
    this.gravities.forEach((gravity) => {});
    vectors.forEach((vector) => this.velocity.add(vector));
    this.x += this.velocity.x;
    this.y += this.velocity.y;
  }

  static create(...args) { return new Particle(...args); }
}

module.exports = Particle;