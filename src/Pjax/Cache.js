/// CACHE
var Cache = module.exports = {
  // extend function -- necessary?
  extend: function(obj) { return Utils.extend(this, obj); },
  // holder
  data: {},
  // set
  set: function(key, val) { this.data[key] = val; },
  // get
  get: function(key) { return this.data[key]; },
  // reset
  reset: function() { this.data = {}; }
};
