var Utils = require('../Utils');

/// TRANSITION
var Transition = module.exports = {
  extend: function(obj){ return Utils.extend(this, obj); },

  oldContainer: undefined,
  newContainer: undefined,
  containerLoaded: undefined,
  completed: undefined,
  /// RENDER
  /// * what should happen during transition
  /// * must call resolve() function at end
  render: function() {},

  /// RESOLVE
  resolve: function() {
    this.oldContainer.parentNode.removeChild(this.oldContainer);
    this.completed.resolve();
  },

  /// INIT
  /// oldContainer = Node
  /// newContainer = Promise
  init: function(oldContainer, promisedContainer) {
    var _this = this;
    var Load = Utils.deferred();

    this.completed = Utils.deferred();
    this.oldContainer = oldContainer;
    this.containerLoaded = Load.promise;

    this.render();

    promisedContainer.then(function(newContainer) {
      _this.newContainer = newContainer;
      Load.resolve();
    });

    return this.completed.promise;
  },

};
