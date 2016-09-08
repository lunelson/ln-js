/**
 * SHAPE PARTICLE
 * renders Oval or Rectangle Shapes
 * has more complex hit / edge testing
 */

class ShapeParticle extends Particle {
  constructor(context, x, y) {
    super(x, y);
    this.type = null; // 'oval' || 'rectangle'
    this.width = null; // radiusX = width/2
    this.height = null; // radiusY = height/2
  }

  isTouching(x,y) /* accept xy || Point || Particle || Shape */{}
  isOffScreen() {/* test based on this.context.canvas */}
  isOffTop() {/* test based on this.context.canvas */}
  isOffRight() {/* test based on this.context.canvas */}
  isOffBottom() {/* test based on this.context.canvas */}
  isOffLeft() {/* test based on this.context.canvas */}
}