////////////////
// PJAX3 TEST //
////////////////

window.Pjax = require('../../src/pjax3');

Pjax.init();

// Pjax.selectTransition = (newState, oldState) => { return transA; }
const transA = new Pjax.Transition(function(newContentLoad, oldContent, newState, oldState) {
  // .... do something
});
