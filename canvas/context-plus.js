/**
 * CONTEXT PLUS
 * bungs additional stuff on to a context
 * probably bad form; but FTS
 */

module.exports = function(ctx) {

  // properties
  ctx.pointerX = 0;
  ctx.pointerY = 0;

  // listeners
  document.addEventListener('mousemove', (event) => {
    var clientRect = ctx.canvas.getBoundingClientRect();
    ctx.pointerX = event.clientX - clientRect.left;
    ctx.pointerY = event.clientY - clientRect.top;
  });

  // methods
  Object.assign(ctx, {

    /**
     * SHAPE
     */

    shape(x, y, points, rotation) {
      this.save();
      this.translate(x, y);
      this.rotate(rotation || 0);
      this.moveTo(...points[0]);
      for (var i = 1; i < points.length; i++) { this.lineTo(...points[i]); }
      this.restore();
    },

    fillShape(x, y, points, rotation, fillStyle/*, closed*/) {
      this.beginPath();
      this.shape(x, y, points, rotation);
      // if (closed) { this.closePath(); }
      this.fillStyle = fillStyle || this.fillStyle;
      this.fill();
    },

    strokeShape(x, y, points, rotation, strokeStyle, lineWidth, closed) {
      this.beginPath();
      this.shape(x, y, points, rotation);
      if (closed) { this.closePath(); }
      this.strokeStyle = strokeStyle || this.strokeStyle;
      this.lineWidth = lineWidth || this.lineWidth;
      this.stroke();
    },

    /**
     * CIRCLE
     */

    circle(x, y, r, ccw) {
      this.arc(x, y, r, 0, Math.PI * 2, ccw);
    },

    fillCircle(x, y, r) {
      this.beginPath();
      this.circle(x, y, r);
      this.fill();
    },

    strokeCircle(x, y, r) {
      this.beginPath();
      this.circle(x, y, r);
      this.stroke();
    },

    /**
     * ELLIPSE
     */

    ellipse(x, y, xr, yr, rotation) {
      this.save();
      this.translate(x, y);
      this.rotate(rotation || 0);
      this.scale(xr / 100, yr / 100);
      this.circle(0, 0, 100);
      this.restore();
    },

    fillEllipse(x, y, xr, yr, rotation) {
      this.beginPath();
      this.ellipse(x, y, xr, yr, rotation);
      this.fill();
    },

    strokeEllipse(x, y, xr, yr, rotation) {
      this.beginPath();
      this.ellipse(x, y, xr, yr, rotation);
      this.stroke();
    },

    /**
     * POLYGON
     */

     polygon(x, y, r, sides, rotation) {
       this.save();
       this.translate(x, y);
       this.rotate(rotation || 0);
       this.moveTo(r, 0);
       for(var i = 1; i < sides; i++) {
         var angle = Math.PI * 2 / sides * i;
         this.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
       }
       this.lineTo(r, 0);
       this.restore();
     },

     fillPolygon(x, y, r, sides, rotation, fillStyle) {
       this.beginPath();
       this.polygon(x, y, r, sides, rotation);
       this.fill();
     },

     strokePolygon(x, y, r, sides, rotation, strokeWidth) {
       this.beginPath();
       this.polygon(x, y, r, sides, rotation);
       this.stroke();
     },

  });

  return ctx;
}

class ContextPlus {

  // setSize(width, height) {
  //   this.canvas.width = width;
  //   this.canvas.height = height;
  // }

  // clear(color) {
  //   if(typeof color == 'undefined') {
  //     this.clearRect(0, 0, this.canvas.width, this.canvas.height);
  //   } else {
  //     this.save();
  //     this.fillStyle = color;
  //     this.fillRect(0, 0, this.canvas.width, this.canvas.height);
  //     this.restore();
  //   }
  // }

  // setFill(r, g, b, a) {
  //   if (typeof r === 'string') {
  //     this.fillStyle = r;
  //   } else if (typeof a == 'undefined') {
  //     this.fillStyle = 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  //   } else {
  //     this.fillStyle = 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ', ' + a + ')';
  //   }
  // }

  // setStroke(r, g, b, a) {
  //   if(typeof r === 'string') {
  //     this.strokeStyle = r;
  //   }
  //   else if(a == 'undefined') {
  //     this.strokeStyle = 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  //   }
  //   else {
  //     this.strokeStyle = 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ', ' + a + ')';
  //   }
  // }

  // setLineWidth(w) {
  //   this.lineWidth = w;
  // }

  // setShadow(color, offsetX, offsetY, blur) {
  //   this.shadowColor = color;
  //   this.shadowOffsetX = offsetX;
  //   this.shadowOffsetY = offsetY;
  //   this.shadowBlur = blur;
  // }

  // rotate(angle) {
  //   this.rotate(angle);
  // }

  // translate(tx, ty) {
  //   this.translate(tx, ty);
  // }

  // scale(sx, sy) {
  //   this.scale(sx, sy);
  // }

  // saveContext() {
  //   this.save();
  // }

  // restoreContext() {
  //   this.restore();
  // }

  // beginPath() {
  //   this.beginPath();
  // }

  // stroke() {
  //   this.stroke();
  // }

  // fill() {
  //   this.fill();
  // }

  // moveTo(x, y) {
  //   this.moveTo(x, y);
  // }

  // lineTo(x, y) {
  //   this.lineTo(x, y);
  // }

  // rect(x, y, w, h) {
  //   this.rect(x, y, w, h);
  // }

  // fillRect(x, y, w, h) {
  //   this.fillRect(x, y, w, h);
  // }

  // strokeRect(x, y, w, h) {
  //   this.strokeRect(x, y, w, h);
  // }

  // roundRect(x, y, w, h, r) {
  //   this.moveTo(x + r, y);
  //   this.lineTo(x + w - r, y);
  //   this.arcTo(x + w, y, x + w, y + r, r);
  //   this.lineTo(x + w, y + h - r);
  //   this.arcTo(x + w, y + h, x + w - r, y + h, r);
  //   this.lineTo(x + r, y + h);
  //   this.arcTo(x, y + h, x, y + h - r, r);
  //   this.lineTo(x, y + r);
  //   this.arcTo(x, y, x + r, y, r);

  // }

  // fillRoundRect(x, y, w, h, r) {
  //   this.beginPath();
  //   this.roundRect(x, y, w, h, r);
  //   this.fill();
  // }

  // strokeRoundRect(x, y, w, h, r) {
  //   this.beginPath();
  //   this.roundRect(x, y, w, h, r);
  //   this.stroke();
  // }

  // arc(x, y, r, start, end, ccw) {
  //   this.arc(x, y, r, start, end, ccw);
  // }

  // arcTo(x1, y1, x2, y2, r) {
  //   this.arcTo(x1, y1, x2, y2, r);
  // }

  // bezierCurveTo(x1, y1, x2, y2, x3, y3) {
  //   this.bezierCurveTo(x1, y1, x2, y2, x3, y3);
  // }

  // quadraticCurveTo(x1, y1, x2, y2) {
  //   this.quadraticCurveTo(x1, y1, x2, y2);
  // }

  // star(x, y, r1, r2, points, rotation) {
  //   this.save();
  //   this.translate(x, y);
  //   this.rotate(rotation || 0);
  //   this.moveTo(r2, 0);
  //   for(var i = 1; i < points * 2; i++) {
  //     var angle = Math.PI / points  * i;
  //     if(i % 2) {
  //       this.lineTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
  //     }
  //     else {
  //       this.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2);
  //     }
  //   }
  //   this.lineTo(r2, 0);
  //   this.restore();

  // }

  // fillStar(x, y, r1, r2, points, rotation) {
  //   this.beginPath();
  //   this.star(x, y, r1, r2, points, rotation);
  //   this.fill();
  // }

  // strokeStar(x, y, r1, r2, points, rotation) {
  //   this.beginPath();
  //   this.star(x, y, r1, r2, points, rotation);
  //   this.stroke();
  // }

  // path(points, closed) {
  //   if(points.length <= 0) return;
  //   this.moveTo(points[0].x, points[0].y);
  //   for(var i = 1; i < points.length; i++) {
  //     this.lineTo(points[i].x, points[i].y);
  //   }
  //   if(closed) {
  //     this.lineTo(points[0].x, points[0].y);
  //   }

  // }

  // fillPath(points, closed) {
  //   this.beginPath();
  //   this.path(points, closed);
  //   this.fill();
  // }

  // strokePath(points, closed) {
  //   this.beginPath();
  //   this.path(points, closed);
  //   this.stroke();
  // }

  //   splat(x, y, numNodes, radius, innerRadius, curve, variation, rotation) {
  //       var points = [],
  //         slice = Math.PI * 2 / (numNodes * 2),
  //         angle = 0,
  //         radiusRange = radius - innerRadius,
  //         r;
  //       curve = curve || 0  ;
  //       variation = variation || 0;

  //       for(var i = 0; i < numNodes; i++) {
  //           r = radius + variation * (Math.random() * radiusRange * 2 - radiusRange);
  //           points.push(makePoint(angle - slice * (1 + curve), innerRadius));
  //           points.push(makePoint(angle + slice * curve, innerRadius));
  //           points.push(makePoint(angle - slice * curve, r));
  //           points.push(makePoint(angle + slice * (1 + curve), r));
  //           angle += slice * 2;
  //       }

  //       this.save();
  //       this.translate(x, y);
  //       this.rotate(rotation || 0);
  //       this.multiCurveLoop(points);
  //       this.restore();

  //     function makePoint(angle, radius) {
  //         return {
  //           x: Math.cos(angle) * radius,
  //           y: Math.sin(angle) * radius
  //         };
  //     }
  //   }

  // fillSplat(x, y, numNodes, radius, innerRadius, curve, variation, rotation) {
  //   this.beginPath();
  //   this.splat(x, y, numNodes, radius, innerRadius, curve, variation, rotation);
  //   this.fill();
  // }

  // strokeSplat(x, y, numNodes, radius, innerRadius, curve, variation, rotation) {
  //   this.beginPath();
  //   this.splat(x, y, numNodes, radius, innerRadius, curve, variation, rotation);
  //   this.stroke();
  // }

  // multiCurve(points) {
  //   var mids = [];
  //   for(var i = 0; i < points.length - 1; i++) {
  //     mids.push({
  //       x: (points[i].x + points[i + 1].x) / 2,
  //       y: (points[i].y + points[i + 1].y) / 2
  //     });
  //   }

  //   this.moveTo(points[0].x, points[0].y);
  //   for(i = 1; i < points.length - 2; i++) {
  //     this.quadraticCurveTo(points[i].x, points[i].y, mids[i].x, mids[i].y);
  //   }
  //   this.quadraticCurveTo(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);

  // }

  // fillMultiCurve(points) {
  //   this.beginPath();
  //   this.multiCurve(points, closed);
  //   this.fill();
  // }

  // strokeMultiCurve(points) {
  //   this.beginPath();
  //   this.multiCurve(points, closed);
  //   this.stroke();
  // }

  // multiCurveLoop(points) {
  //   var mids = [];
  //   for(var i = 0; i < points.length - 1; i++) {
  //     mids.push({
  //       x: (points[i].x + points[i + 1].x) / 2,
  //       y: (points[i].y + points[i + 1].y) / 2
  //     });
  //   }
  //   mids.push({
  //     x: (points[i].x + points[0].x) / 2,
  //     y: (points[i].y + points[0].y) / 2
  //   });

  //   this.moveTo(mids[0].x, mids[0].y);
  //   for(i = 1; i < points.length; i++) {
  //     this.quadraticCurveTo(points[i].x, points[i].y, mids[i].x, mids[i].y);
  //   }
  //   this.quadraticCurveTo(points[0].x, points[0].y, mids[0].x, mids[0].y);

  // }

  // fillMultiCurveLoop(points) {
  //   this.beginPath();
  //   this.multiCurveLoop(points, closed);
  //   this.fill();
  // }

  // strokeMultiCurveLoop(points) {
  //   this.beginPath();
  //   this.multiCurveLoop(points, closed);
  //   this.stroke();
  // }

  // fractalLine(x1, y1, x2, y2, offset, roughness, iterations) {
  //   roughness = roughness || 0.5;
  //   iterations = iterations || 5;
  //   if(offset == 'undefined') {
  //     var dx = x2 - x1,
  //       dy = y2 - y1;
  //     offset = Math.sqrt(dx * dx + dy * dy) * .15;
  //   }

  //   var path = [{x: x1, y: y1}, {x: x2, y: y2}];
  //   for(var i = 0; i < iterations; i++) {
  //     for(var j = path.length - 1; j > 0; j--) {
  //       path.splice(j, 0, {
  //         x: (path[j].x + path[j - 1].x) / 2 + Math.random() * offset * 2 - offset,
  //         y: (path[j].y + path[j - 1].y) / 2 + Math.random() * offset * 2 - offset
  //       });
  //     }
  //     offset *= roughness;
  //   }
  //   this.path(path);
  // }

  // strokeFractalLine(x1, y1, x2, y2, offset, roughness, iterations) {
  //   this.beginPath();
  //   this.fractalLine(x1, y1, x2, y2, offset, roughness, iterations);
  //   this.stroke();
  // }

  // heart(x, y, w, h, r) {
  //   this.save();
  //   this.translate(x, y);
  //   this.rotate(r);
  //   var points = [{ x: 0,          y: h *  0.5   },
  //           { x: 0,          y: h *  0.375 },
  //           { x: w * -0.625, y: h * -0.125 },
  //           { x: w * -0.25,  y: h * -0.625 },
  //           { x: 0,          y: h * -0.375 }];

  //   this.multiCurve(points);
  //   for(var i = 0; i < points.length; i++) {
  //     points[i].x *= -1;
  //   }
  //   this.multiCurve(points);
  //   this.restore();
  // }

  // fillHeart(x, y, w, h, r) {
  //   this.beginPath();
  //   this.heart(x, y, w, h, r);
  //   this.fill();
  // }

  // strokeHeart(x, y, w, h, r) {
  //   this.beginPath();
  //   this.heart(x, y, w, h, r);
  //   this.stroke();
  // }

  // grid(x, y, w, h, xres, yres) {
  //   yres = yres || xres;
  //   for(var i = x; i <= x + w; i += xres) {
  //     this.moveTo(i, y);
  //     this.lineTo(i, y + h);
  //   }
  //   for(i = y; i <= y + h; i += yres) {
  //     this.moveTo(x, i);
  //     this.lineTo(x + w, i);
  //   }
  // }

  // strokeGrid(x, y, w, h, xres, yres) {
  //   this.beginPath();
  //   this.grid(x, y, w, h, xres, yres);
  //   this.stroke();
  // }
}
