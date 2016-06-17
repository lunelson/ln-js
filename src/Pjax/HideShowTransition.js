var Transition = require('./Transition');

var HideShowTransition = module.exports = Transition.extend({
  start: function() {
    this.newContainerPromise.then(this.hideShow.bind(this));
  },

  hideShow: function() {
    this.oldContainer.style.visibility = 'hidden';
    this.newContainer.style.visibility = 'visible';
    document.body.scrollTop = 0;

    this.done();
  }
});
