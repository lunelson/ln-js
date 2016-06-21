const Transition = require('./pjax2-transition.js');

function outro(oldContainer, TL, anchorEl){
  TL.to(oldContainer, 1, {autoAlpha: 0});
}

function intro(newContainer, TL){
  TL.from(newContainer, 1, {autoAlpha: 1});
}

module.exports = new Transition(outro, intro);
