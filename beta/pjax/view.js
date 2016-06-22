var Dispatcher = require('../dispatcher');
var Utils      = require('./utils');

/// VIEW
var View = module.exports = {
  extend: function(obj){ return Utils.extend(this, obj); },

  namespace: null,

  newStart: function() {},
  newComplete: function() {},
  oldStart: function() {},
  oldComplete: function() {},

  init: function() {
    var _this = this;

    Dispatcher.on('stateChange',
      function(newStatus, oldStatus) {
        if (oldStatus && oldStatus.namespace === _this.namespace)
          // oldContainer ready to trans OUT
          _this.oldStart();
      }
    );

    Dispatcher.on('containerLoad',
      function(newStatus, oldStatus, container) {
        _this.container = container;

        if (newStatus.namespace === _this.namespace)
          // newContainer is ready to trans IN
          _this.newStart();
      }
    );

    Dispatcher.on('transitionEnd',
      function(newStatus, oldStatus) {
        if (newStatus.namespace === _this.namespace)
          // newContainer trans IN is complete
          _this.newComplete();

        if (oldStatus && oldStatus.namespace === _this.namespace)
          // oldContainer trans OUT is complete
          _this.oldComplete();
      }
    );
  }
}
