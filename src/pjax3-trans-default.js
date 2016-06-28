//      _       __            _ _ _____                   _ _   _
//     | |     / _|          | | |_   _|                 (_) | (_)
//   __| | ___| |_ __ _ _   _| | |_| |_ __ __ _ _ __  ___ _| |_ _  ___  _ __
//  / _` |/ _ \  _/ _` | | | | | __| | '__/ _` | '_ \/ __| | __| |/ _ \| '_ \
// | (_| |  __/ || (_| | |_| | | |_| | | | (_| | | | \__ \ | |_| | (_) | | | |
//  \__,_|\___|_| \__,_|\__,_|_|\__\_/_|  \__,_|_| |_|___/_|\__|_|\___/|_| |_|

const Transition = require('./pjax3-trans.js');

module.exports = new Transition(function(newContentLoad, oldContent, newState, oldState) {

  newContentLoad.then((newContent) => {

    this.TL.to(oldContent, 0.25, {autoAlpha: 0});
    this.TL.add(swapContent);
    this.TL.from(newContent, 0.25, {autoAlpha: 0});

    function swapContent() {
      let parentNode = oldContent.parentNode;
      parentNode.removeChild(oldContent);
      parentNode.appendChild(newContent);
    }
  })
});
