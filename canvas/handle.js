/**
 * Handle
 * extension of Particle, Shape
 * NEXT
 * check for presence of contextPlus, add if not present
 * figure out how to save/restore styles, also provide a 'selected' style, in options
 */

var hitTests = {
  rectPoint(x, y) {
    return false;
  },

  circlePoint(x, y) {
    return Math.hypot(this.x - x, this.y - y) < this.radius;
  },

  circleCircle(x, y, radius) {
    return Math.hypot(this.x - x, this.y - y) < (this.radius + radius);
  },

  circleRect(x, y, width, height) {
  }
}

module.exports = class Handle {

  constructor(ctx, x, y, options, updateCallback) {
    // TODO: test ctx to see if it's got context-plus; if not, extend it
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.offsetX = 0;
    this.offsetY = 0;
    this.updateCallback = updateCallback;
    Object.assign(this, {
      radius: 10,
      shape: null,
      rect: null,
      fillStyle: 'rgb(200,100,100)',
      strokeStyle: null,
      lineWidth: null,
      movableX: true,
      movableY: true
    }, options);
    this.pointerTest = (this.rect || this.shape) ? hitTests.rectPoint : hitTests.circlePoint;
    Handle.register(this);
  }

  draw(){

    // DRAW THE HANDLE
    this.ctx.beginPath();
    if (this.shape) {}
    else if (this.rect) {}
    else { this.ctx.circle(this.x, this.y, this.radius); }

    // STROKE OR FILL THE HANDLE
    if (this.strokeStyle || this.lineWidth) {
      this.ctx.strokeStyle = this.strokeStyle || this.ctx.strokeStyle;
      this.ctx.lineWidth = this.lineWidth || this.ctx.lineWidth;
      this.ctx.stroke();
    } else {
      this.ctx.fillStyle = this.fillStyle;
      this.ctx.fill();
    }
  }

  static register(instance) {
    if (!this.initialized) { this.init(); }
    this.instances.push(instance);
  }

  static init(){
    this.instances = [];
    document.addEventListener('mousedown', (event) => {
      var clicked = null;
      for (var n = 0; n < this.instances.length; n++) {
        var current = this.instances[n];
        if (current.pointerTest(current.ctx.pointerX, current.ctx.pointerY)) {
          clicked = current;
          break;
        }
      }
      if (clicked) {
        // TODO: figure out how to save and restore styles...
        var prevFillStyle = clicked.fillStyle;
        clicked.fillStyle = 'rgb(20,20,20)';
        clicked.offsetX = clicked.x - clicked.ctx.pointerX;
        clicked.offsetY = clicked.y - clicked.ctx.pointerY;
        document.addEventListener('mousemove', mouseMove);
        document.addEventListener('mouseup', mouseUp);
        function mouseMove(){
          if (clicked.movableX) { clicked.x = clicked.ctx.pointerX + clicked.offsetX; }
          if (clicked.movableY) { clicked.y = clicked.ctx.pointerY + clicked.offsetY; }
        }
        function mouseUp(){
          clicked.fillStyle = prevFillStyle;
          clicked.updateCallback();
          document.removeEventListener('mousemove', mouseMove);
          document.removeEventListener('mouseup', mouseUp);
        }
      }
    });
    this.initialized = true;
  }
}
