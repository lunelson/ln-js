//                     _ _
//                    | (_)
//  _ __ ___   ___  __| |_  __ _
// | '_ ` _ \ / _ \/ _` | |/ _` |
// | | | | | |  __/ (_| | | (_| |
// |_| |_| |_|\___|\__,_|_|\__,_|

var Media = {},
    queries = {},
    listeners = {},
    matches = {},
    changeHandlers = [],
    enterHandlers = {},
    leaveHandlers = {},
    emValueDefaults = {
      alpha: 20,
      beta: 30,
      gamma: 48,
      delta: 64,
      epsilon: 80
    };

// set things up
Media.init = function(emValues){

  emValues = emValues || emValueDefaults;

  // remove existing, if any
  if (Object.keys(queries).length) {
    Object.keys(queries).forEach(function(key){
      queries[key].removeListener(listeners[key]);
    });
  }

  // re-create queries
  queries = Object.keys(emValues).reduce(function(collector, key){
    collector[key] = global.matchMedia('(min-width: ' + emValues[key] + 'em)');
    return collector;
  },{});

  // re-create listeners
  listeners = Object.keys(queries).reduce(function(collector, key, i, keys){
    collector[key] = function(query){

      // TODO: update matches object

      // call all changeHandlers
      var n = changeHandlers.length;
      while (n--) { changeHandlers[n](); }

      // call applicable enterHandlers
      var enterQuery = query.matches ? keys[i + 1] : key;
      if (!enterHandlers[enterQuery]) enterHandlers[enterQuery] = [];
      var n = enterHandlers[enterQuery].length;
      while (n--) { enterHandlers[enterQuery][n](); }

      // call applicable leaveHandlers
      var leaveQuery = query.matches ? key : keys[i + 1];
      if (!leaveHandlers[leaveQuery]) leaveHandlers[leaveQuery] = [];
      var n = leaveHandlers[leaveQuery].length;
      while (n--) { leaveHandlers[leaveQuery][n](); }

    };
    return collector;
  },{});

  // add listeners to queries and fire them once
  Object.keys(queries).forEach(function(key){
    queries[key].addListener(listeners[key]);
    // listeners[key](queries[key]);
  });

  return Media;
};

// TODO: fn to check whether match for current medium is true
// falseFn and listen are optional, if provided and true, add onEnter/onLeave handlers too
Media.ifMatch = function(medium, trueFn, falseFn, listen){};

Media.is = function(medium){};
Media.lt = function(medium){};
Media.gt = function(medium){};

// queue fns to fire on change of media
Media.onChange = function(fn, immediate){
  var n = changeHandlers.length;
  changeHandlers.push(fn);
  if (immediate) changeHandlers[n]();
};

// queue fns to fire on entering a medium
Media.onEnter = function(medium, fn, immediate){
  if (!enterHandlers[medium]) enterHandlers[medium] = [];
  var n = enterHandlers[medium].length;
  enterHandlers[medium].push(fn);
  if (immediate) enterHandlers[medium][n]();
};

// queue fns to fire on leaving a medium
Media.onLeave = function(medium, fn, immediate){
  var n = leaveHandlers[medium].length;
  leaveHandlers[medium].push(fn);
  if (immediate) leaveHandlers[medium][n]();
};

Media.init();
// Media.queries = queries;
// Media.listeners = listeners;
// Media.changeHandlers = changeHandlers;
// Media.enterHandlers = enterHandlers;
// Media.leaveHandlers = leaveHandlers;
module.exports = Media;