//      _       __            _ _ _____                   _ _   _
//     | |     / _|          | | |_   _|                 (_) | (_)
//   __| | ___| |_ __ _ _   _| | |_| |_ __ __ _ _ __  ___ _| |_ _  ___  _ __
//  / _` |/ _ \  _/ _` | | | | | __| | '__/ _` | '_ \/ __| | __| |/ _ \| '_ \
// | (_| |  __/ || (_| | |_| | | |_| | | | (_| | | | \__ \ | |_| | (_) | | | |
//  \__,_|\___|_| \__,_|\__,_|_|\__\_/_|  \__,_|_| |_|___/_|\__|_|\___/|_| |_|

const Transition = require('./pjax2-transition.js');

function outro(oldContainer, TL){ TL.to(oldContainer, 0.25, {autoAlpha: 0}); }
function intro(newContainer, TL){ TL.from(newContainer, 0.25, {autoAlpha: 0}); }

module.exports = new Transition(outro, intro);
