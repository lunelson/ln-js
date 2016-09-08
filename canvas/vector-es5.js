var Vector = (function(){
  // helpers
  function updateH(){
    this._rad = Math.atan2(this._y, this._x);
    this._len = Math.hypot(this._y, this._x);
  }
  function updateXY(){
    this._x = Math.cos(this._rad) * this._len;
    this._y = Math.sin(this._rad) * this._len;
  }
  // prototype
  var proto = {
    // getters
    get x() { return this._x; },
    get y() { return this._y; },
    get xy() { return [this._x, this._y]; },
    get rad() { return this._rad; },
    get deg() { return this._rad * 180 / Math.PI; },
    get len() { return this._len; },
    // setters
    set x(x) { this._x = x; updateH.call(this); },
    set y(y) { this._y = y; updateH.call(this); },
    set len(len) { this._len = len; updateXY.call(this); },
    set rad(rad) { this._rad = rad; updateXY.call(this); },
    set deg(deg) {  this._rad = deg / 180 * Math.PI; updateXY.call(this); },
    set xy(xy){ this._x = xy[0]; this._y = xy[1]; updateH.call(this); },
    set radlen(radlen) { this._rad = radlen[0]; this._len = radlen[1]; updateXY.call(this); },
    set lenrad(lenrad) { this._rad = lenrad[1]; this._len = lenrad[0]; updateXY.call(this); },
    set deglen(deglen) { this._rad = deglen[0] / 180 * Math.PI; this._len = deglen[1]; updateXY.call(this); },
    set lendeg(lendeg) { this._rad = lendeg[1] / 180 * Math.PI; this._len = lendeg[0]; updateXY.call(this); },
    // methods
    plus: function (b) { return Vector(this._x + b.x, this._y + b.y); },
    minus: function (b) { return Vector(this._x - b.x, this._y - b.y); },
    times: function (n) { return Vector(this._x * n, this._y * n); },
  };
  // constructor
  function Vector(x, y) {
    var instance = Object.create(proto);
    if (typeof(x) === 'object') {
      var obj = x;
      if (obj.len !== undefined) {
        // we are working with magnitude and angle
        var len = obj.len,
            deg = obj.deg || 0,
            rad = obj.rad || obj.deg / 180 * Math.PI;
        instance.radlen = [rad, len];
      } else {
        // we are working with x and y
        y = obj.y || 0;
        x = obj.x || 0;
        instance.xy = [x, y];
      }
    } else {
      // args are straight x and y
      y = y || 0;
      x = x || 0;
      instance.xy = [x, y];
    }
    return instance;
  };

  // class/type methods
  Vector.sum = Function.prototype.call.bind(proto.plus);
  Vector.diff = Function.prototype.call.bind(proto.minus);
  Vector.scale = Function.prototype.call.bind(proto.times);

  return Vector;
})();