(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
/*! Native Promise Only
    v0.8.1 (c) Kyle Simpson
    MIT License: http://getify.mit-license.org
*/

(function UMD(name,context,definition){
	// special form of UMD for polyfilling across evironments
	context[name] = context[name] || definition();
	if (typeof module != "undefined" && module.exports) { module.exports = context[name]; }
	else if (typeof define == "function" && define.amd) { define(function $AMD$(){ return context[name]; }); }
})("Promise",typeof global != "undefined" ? global : this,function DEF(){
	/*jshint validthis:true */
	"use strict";

	var builtInProp, cycle, scheduling_queue,
		ToString = Object.prototype.toString,
		timer = (typeof setImmediate != "undefined") ?
			function timer(fn) { return setImmediate(fn); } :
			setTimeout
	;

	// dammit, IE8.
	try {
		Object.defineProperty({},"x",{});
		builtInProp = function builtInProp(obj,name,val,config) {
			return Object.defineProperty(obj,name,{
				value: val,
				writable: true,
				configurable: config !== false
			});
		};
	}
	catch (err) {
		builtInProp = function builtInProp(obj,name,val) {
			obj[name] = val;
			return obj;
		};
	}

	// Note: using a queue instead of array for efficiency
	scheduling_queue = (function Queue() {
		var first, last, item;

		function Item(fn,self) {
			this.fn = fn;
			this.self = self;
			this.next = void 0;
		}

		return {
			add: function add(fn,self) {
				item = new Item(fn,self);
				if (last) {
					last.next = item;
				}
				else {
					first = item;
				}
				last = item;
				item = void 0;
			},
			drain: function drain() {
				var f = first;
				first = last = cycle = void 0;

				while (f) {
					f.fn.call(f.self);
					f = f.next;
				}
			}
		};
	})();

	function schedule(fn,self) {
		scheduling_queue.add(fn,self);
		if (!cycle) {
			cycle = timer(scheduling_queue.drain);
		}
	}

	// promise duck typing
	function isThenable(o) {
		var _then, o_type = typeof o;

		if (o != null &&
			(
				o_type == "object" || o_type == "function"
			)
		) {
			_then = o.then;
		}
		return typeof _then == "function" ? _then : false;
	}

	function notify() {
		for (var i=0; i<this.chain.length; i++) {
			notifyIsolated(
				this,
				(this.state === 1) ? this.chain[i].success : this.chain[i].failure,
				this.chain[i]
			);
		}
		this.chain.length = 0;
	}

	// NOTE: This is a separate function to isolate
	// the `try..catch` so that other code can be
	// optimized better
	function notifyIsolated(self,cb,chain) {
		var ret, _then;
		try {
			if (cb === false) {
				chain.reject(self.msg);
			}
			else {
				if (cb === true) {
					ret = self.msg;
				}
				else {
					ret = cb.call(void 0,self.msg);
				}

				if (ret === chain.promise) {
					chain.reject(TypeError("Promise-chain cycle"));
				}
				else if (_then = isThenable(ret)) {
					_then.call(ret,chain.resolve,chain.reject);
				}
				else {
					chain.resolve(ret);
				}
			}
		}
		catch (err) {
			chain.reject(err);
		}
	}

	function resolve(msg) {
		var _then, self = this;

		// already triggered?
		if (self.triggered) { return; }

		self.triggered = true;

		// unwrap
		if (self.def) {
			self = self.def;
		}

		try {
			if (_then = isThenable(msg)) {
				schedule(function(){
					var def_wrapper = new MakeDefWrapper(self);
					try {
						_then.call(msg,
							function $resolve$(){ resolve.apply(def_wrapper,arguments); },
							function $reject$(){ reject.apply(def_wrapper,arguments); }
						);
					}
					catch (err) {
						reject.call(def_wrapper,err);
					}
				})
			}
			else {
				self.msg = msg;
				self.state = 1;
				if (self.chain.length > 0) {
					schedule(notify,self);
				}
			}
		}
		catch (err) {
			reject.call(new MakeDefWrapper(self),err);
		}
	}

	function reject(msg) {
		var self = this;

		// already triggered?
		if (self.triggered) { return; }

		self.triggered = true;

		// unwrap
		if (self.def) {
			self = self.def;
		}

		self.msg = msg;
		self.state = 2;
		if (self.chain.length > 0) {
			schedule(notify,self);
		}
	}

	function iteratePromises(Constructor,arr,resolver,rejecter) {
		for (var idx=0; idx<arr.length; idx++) {
			(function IIFE(idx){
				Constructor.resolve(arr[idx])
				.then(
					function $resolver$(msg){
						resolver(idx,msg);
					},
					rejecter
				);
			})(idx);
		}
	}

	function MakeDefWrapper(self) {
		this.def = self;
		this.triggered = false;
	}

	function MakeDef(self) {
		this.promise = self;
		this.state = 0;
		this.triggered = false;
		this.chain = [];
		this.msg = void 0;
	}

	function Promise(executor) {
		if (typeof executor != "function") {
			throw TypeError("Not a function");
		}

		if (this.__NPO__ !== 0) {
			throw TypeError("Not a promise");
		}

		// instance shadowing the inherited "brand"
		// to signal an already "initialized" promise
		this.__NPO__ = 1;

		var def = new MakeDef(this);

		this["then"] = function then(success,failure) {
			var o = {
				success: typeof success == "function" ? success : true,
				failure: typeof failure == "function" ? failure : false
			};
			// Note: `then(..)` itself can be borrowed to be used against
			// a different promise constructor for making the chained promise,
			// by substituting a different `this` binding.
			o.promise = new this.constructor(function extractChain(resolve,reject) {
				if (typeof resolve != "function" || typeof reject != "function") {
					throw TypeError("Not a function");
				}

				o.resolve = resolve;
				o.reject = reject;
			});
			def.chain.push(o);

			if (def.state !== 0) {
				schedule(notify,def);
			}

			return o.promise;
		};
		this["catch"] = function $catch$(failure) {
			return this.then(void 0,failure);
		};

		try {
			executor.call(
				void 0,
				function publicResolve(msg){
					resolve.call(def,msg);
				},
				function publicReject(msg) {
					reject.call(def,msg);
				}
			);
		}
		catch (err) {
			reject.call(def,err);
		}
	}

	var PromisePrototype = builtInProp({},"constructor",Promise,
		/*configurable=*/false
	);

	// Note: Android 4 cannot use `Object.defineProperty(..)` here
	Promise.prototype = PromisePrototype;

	// built-in "brand" to signal an "uninitialized" promise
	builtInProp(PromisePrototype,"__NPO__",0,
		/*configurable=*/false
	);

	builtInProp(Promise,"resolve",function Promise$resolve(msg) {
		var Constructor = this;

		// spec mandated checks
		// note: best "isPromise" check that's practical for now
		if (msg && typeof msg == "object" && msg.__NPO__ === 1) {
			return msg;
		}

		return new Constructor(function executor(resolve,reject){
			if (typeof resolve != "function" || typeof reject != "function") {
				throw TypeError("Not a function");
			}

			resolve(msg);
		});
	});

	builtInProp(Promise,"reject",function Promise$reject(msg) {
		return new this(function executor(resolve,reject){
			if (typeof resolve != "function" || typeof reject != "function") {
				throw TypeError("Not a function");
			}

			reject(msg);
		});
	});

	builtInProp(Promise,"all",function Promise$all(arr) {
		var Constructor = this;

		// spec mandated checks
		if (ToString.call(arr) != "[object Array]") {
			return Constructor.reject(TypeError("Not an array"));
		}
		if (arr.length === 0) {
			return Constructor.resolve([]);
		}

		return new Constructor(function executor(resolve,reject){
			if (typeof resolve != "function" || typeof reject != "function") {
				throw TypeError("Not a function");
			}

			var len = arr.length, msgs = Array(len), count = 0;

			iteratePromises(Constructor,arr,function resolver(idx,msg) {
				msgs[idx] = msg;
				if (++count === len) {
					resolve(msgs);
				}
			},reject);
		});
	});

	builtInProp(Promise,"race",function Promise$race(arr) {
		var Constructor = this;

		// spec mandated checks
		if (ToString.call(arr) != "[object Array]") {
			return Constructor.reject(TypeError("Not an array"));
		}

		return new Constructor(function executor(resolve,reject){
			if (typeof resolve != "function" || typeof reject != "function") {
				throw TypeError("Not a function");
			}

			iteratePromises(Constructor,arr,function resolver(idx,msg){
				resolve(msg);
			},reject);
		});
	});

	return Promise;
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],2:[function(require,module,exports){
"use strict";

/**
 * Little Dispatcher inspired by MicroEvent.js
 *
 * @namespace Barba.Dispatcher
 * @type {Object}
 */
var Dispatcher = {
  /**
   * Event array
   *
   * @memberOf Barba.Dispatcher
   * @readOnly
   * @type {Object}
   */
  events: {},

  /**
   * Bind a callback to an event
   *
   * @memberOf Barba.Dispatcher
   * @param  {String} eventName
   * @param  {Function} function
   */
  on: function on(e, f) {
    this.events[e] = this.events[e] || [];
    this.events[e].push(f);
  },


  /**
   * Unbind event
   *
   * @memberOf Barba.Dispatcher
   * @param  {String} eventName
   * @param  {Function} function
   */
  off: function off(e, f) {
    if (e in this.events === false) return;

    this.events[e].splice(this.events[e].indexOf(f), 1);
  },


  /**
   * Fire the event running all the event associated
   *
   * @memberOf Barba.Dispatcher
   * @param  {String} eventName
   * @param {...*} args
   */
  trigger: function trigger(e) {
    //e, ...args
    if (e in this.events === false) return;

    for (var i = 0; i < this.events[e].length; i++) {
      this.events[e][i].apply(this, Array.prototype.slice.call(arguments, 1));
    }
  }
};

module.exports = Dispatcher;

},{}],3:[function(require,module,exports){
'use strict';

/// Promise polyfill https://github.com/taylorhakes/promise-polyfill
/// alternative -- https://github.com/getify/native-promise-only
if (typeof Promise !== 'function') {
  window.Promise = require('native-promise-only');
}

// general
var Dispatcher = require('./Dispatcher');

// pjax specific stuff
var Cache = require('./Pjax/Cache');
var Dom = require('./Pjax/Dom');
var History = require('./Pjax/History');
var Prefetch = require('./Pjax/Prefetch');
var Transition = require('./Pjax/Transition');
var View = require('./Pjax/View');
var Utils = require('./Pjax/Utils');

/// get current URL
function getCurrentUrl() {
  return Utils.cleanLink(Utils.getCurrentUrl());
}

// TODO: rename the following two functions
/// go to
// function goTo(url) {
//   window.history.pushState(null, null, url);
//   onStateChange();
// }
/// force go to
function forceGoTo(url) {
  window.location = url;
}

/// linkClick handler
function onLinkClick(event) {
  // resolve the element
  var element = event.target;
  while (element && !element.href) {
    element = element.parentNode;
  }
  // check if element is valid
  if (Utils.validLink(element, event)) {
    event.stopPropagation();
    event.preventDefault();
    // fire and update
    Dispatcher.trigger('linkClick', element);
    window.history.pushState(null, null, element.href);
    onStateChange();
  }
}

/// stateChange handler
function onStateChange(arg) {
  // get new URL
  var newUrl = getCurrentUrl();
  // bail out, if current URL is same as new URL
  if (History.currentStatus().url === newUrl) return false;
  // check if transition in progress
  if (Pjax.transitionInProgress) {
    /// if trans in prog, force go to new URL
    /// NB. this is where we'd have to cancel the current transition and start another one
    forceGoTo(newUrl);
  }
  // otherwise...
  // fire internal events
  Dispatcher.trigger('stateChange', History.currentStatus(), History.prevStatus());
  // add URL to internal history manager
  History.add(newUrl);
  // get the promise for the new container
  var gotContainer = Pjax.load(newUrl);
  // this should not at all be necessary
  var transition = Object.create(Pjax.getTransition());
  Pjax.transitionInProgress = true;
  var transitionInstance = transition.init(Dom.getContainer(), gotContainer);
  gotContainer.then(onContainerLoad);
  transitionInstance.then(onTransitionEnd);
}

/// containerLoad handler
function onContainerLoad(container) {
  var currentStatus = History.currentStatus();
  currentStatus.namespace = Dom.getNamespace(container);
  Dispatcher.trigger('newPageReady', History.currentStatus(), History.prevStatus(), container);
}

/// transitionEnd handler
function onTransitionEnd() {
  Pjax.transitionInProgress = false;
  Dispatcher.trigger('transitionEnd', History.currentStatus(), History.prevStatus());
}

/// PJAX
var Pjax = module.exports = {

  /// whether to use cache
  cacheEnabled: true,

  /// whether transition is in progress
  transitionInProgress: false,

  /// what transition to use
  /// * either change this...
  defaultTransition: require('./Pjax/HideShowTransition'),
  /// ...or change this, to affect defaults
  getTransition: function getTransition() {
    return this.defaultTransition;
  },

  /// initialize
  init: function init() {

    // get the container
    var container = Dom.getContainer();

    History.add(getCurrentUrl(), Dom.getNamespace(container));

    // fire custom events for the current view.
    Dispatcher.trigger('stateChange', History.currentStatus());
    Dispatcher.trigger('newPageReady', History.currentStatus(), {}, container);
    Dispatcher.trigger('transitionEnd', History.currentStatus());

    // bind native events
    document.addEventListener('click', onLinkClick);
    window.addEventListener('popstate', onStateChange);
  },

  /// load a new page; return Promise
  load: function load(url) {
    var deferred = Utils.deferred();
    var xhr = Cache.get(url);
    if (!xhr) {
      xhr = Utils.xhr(url);
      Cache.set(url, xhr);
    }
    xhr.then(
    // success
    function (data) {
      var container = Dom.parseResponse(data);
      Dom.putContainer(container);
      if (!Pjax.cacheEnabled) Cache.reset();
      deferred.resolve(container);
    },
    // error
    function () {
      window.location = url;
      deferred.reject();
    });
    return deferred.promise;
  },

  /// exposure of other objects
  Cache: Cache,
  Dom: Dom,
  History: History,
  Prefetch: Prefetch,
  Transition: Transition,
  Utils: Utils,
  View: View
};

},{"./Dispatcher":2,"./Pjax/Cache":4,"./Pjax/Dom":5,"./Pjax/HideShowTransition":6,"./Pjax/History":7,"./Pjax/Prefetch":8,"./Pjax/Transition":9,"./Pjax/Utils":10,"./Pjax/View":11,"native-promise-only":1}],4:[function(require,module,exports){
"use strict";

/// CACHE
var Cache = module.exports = {
  // extend function -- necessary?
  extend: function extend(obj) {
    return Utils.extend(this, obj);
  },
  // holder
  data: {},
  // set
  set: function set(key, val) {
    this.data[key] = val;
  },
  // get
  get: function get(key) {
    return this.data[key];
  },
  // reset
  reset: function reset() {
    this.data = {};
  }
};

},{}],5:[function(require,module,exports){
'use strict';

/// DOM
var Dom = module.exports = {

  /// data NAMESPACE default
  dataNamespace: 'namespace',

  /// wrapper ID default
  /// * there will only ever be one of these
  wrapperId: 'pjax-wrapper',

  /// container CLASS default
  /// * there will at a point be two of these in the DOM (old and new)
  containerClass: 'pjax-container',

  /// parse the response from XHR
  /// 1. place content in detached div
  /// 2. parse out <title> element text and set it
  /// 3. extract the newContainer element
  parseResponse: function parseResponse(responseText) {
    var wrapper = document.createElement('div');
    wrapper.innerHTML = responseText;
    var titleEl = wrapper.querySelector('title');
    if (titleEl) document.title = titleEl.textContent;
    return this.getContainer(wrapper);
  },

  /// get the wrapper
  getWrapper: function getWrapper() {
    return document.getElementById(this.wrapperId);
  },

  /// get the container
  /// * accept a given wrapper, or use default wrapper
  getContainer: function getContainer(wrapper) {
    if (!wrapper) wrapper = this.getWrapper();
    if (!wrapper) throw new Error('Barba.js: DOM not ready!');
    var container = wrapper.querySelector('.' + this.containerClass);
    if (container && container.jquery) container = container[0];
    if (!container) throw new Error('Barba.js: no container found');
    return container;
  },

  /// get the namespace of the container
  getNamespace: function getNamespace(container) {
    if (container && container.dataset) {
      return container.dataset[this.dataNamespace];
    } else if (container) {
      return container.getAttribute('data-' + this.dataNamespace);
    }
    return null;
  },

  /// put the container in to the wrapper, with visibility 'hidden'
  putContainer: function putContainer(container) {
    container.style.visibility = 'hidden';
    this.getWrapper().appendChild(container);
  }
};

},{}],6:[function(require,module,exports){
'use strict';

var Transition = require('./Transition');

var HideShowTransition = module.exports = Transition.extend({
  start: function start() {
    this.newContainerPromise.then(this.hideShow.bind(this));
  },

  hideShow: function hideShow() {
    this.oldContainer.style.visibility = 'hidden';
    this.newContainer.style.visibility = 'visible';
    document.body.scrollTop = 0;

    this.done();
  }
});

},{"./Transition":9}],7:[function(require,module,exports){
"use strict";

/// HISTORY
var History = module.exports = {

  history: [],

  add: function add(url, namespace) {
    if (!namespace) namespace = undefined;

    this.history.push({
      url: url,
      namespace: namespace
    });
  },

  currentStatus: function currentStatus() {
    return this.history[this.history.length - 1];
  },

  prevStatus: function prevStatus() {
    var history = this.history;

    if (history.length < 2) return null;

    return history[history.length - 2];
  }
};

},{}],8:[function(require,module,exports){
'use strict';

var Utils = require('./Utils');
var Cache = require('./Cache');

function onLinkEnter(event) {
  // get event target
  var el = event.target;
  // traverse up until valid href
  while (el && !el.href) {
    el = el.parentNode;
  }
  // if nothing found, bail
  if (!el) {
    return;
  }
  // get the URL
  var url = el.href;
  // if link is valid...
  if (Utils.validLink(el, event) && !Cache.get(url)) {
    // get the content
    var xhr = Utils.xhr(url);
    // bung it in the cache
    Cache.set(url, xhr);
  }
}

/// PREFETCH
var Prefetch = module.exports = {
  init: function init() {
    document.body.addEventListener('mouseover', onLinkEnter);
    document.body.addEventListener('touchstart', onLinkEnter);
  }
};

},{"./Cache":4,"./Utils":10}],9:[function(require,module,exports){
'use strict';

var Utils = require('./Utils');

/// TRANSITION
var Transition = module.exports = {
  extend: function extend(obj) {
    return Utils.extend(this, obj);
  },

  oldContainer: undefined,
  newContainer: undefined,
  containerLoaded: undefined,
  completed: undefined,
  /// RENDER
  /// * what should happen during transition
  /// * must call resolve() function at end
  render: function render() {},

  /// RESOLVE
  resolve: function resolve() {
    this.oldContainer.parentNode.removeChild(this.oldContainer);
    this.completed.resolve();
  },

  /// INIT
  /// oldContainer = Node
  /// newContainer = Promise
  init: function init(oldContainer, promisedContainer) {
    var _this = this;
    var Load = Utils.deferred();

    this.completed = Utils.deferred();
    this.oldContainer = oldContainer;
    this.containerLoaded = Load.promise;

    this.render();

    promisedContainer.then(function (newContainer) {
      _this.newContainer = newContainer;
      Load.resolve();
    });

    return this.completed.promise;
  }

};

},{"./Utils":10}],10:[function(require,module,exports){
'use strict';

/**
 * Just an object with some helpful functions
 *
 * @type {Object}
 * @namespace Barba.Utils
 */
var Utils = {
  /**
   * Return the current url
   *
   * @memberOf Barba.Utils
   * @return {String} currentUrl
   */
  getCurrentUrl: function getCurrentUrl() {
    return window.location.protocol + '//' + window.location.host + window.location.pathname + window.location.search;
  },

  /**
   * Given an url, return it without the hash
   *
   * @memberOf Barba.Utils
   * @param  {String} url
   * @return {String} newCleanUrl
   */
  cleanLink: function cleanLink(url) {
    return url.replace(/#.*/, '');
  },

  /// whether a link should be followed
  validLink: function validLink(element, event) {
    if (!history.pushState) return false;
    /// user
    if (!element || !element.href) return false;
    /// middle click, cmd click, and ctrl click
    if (event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    /// ignore target with _blank target
    if (element.target && element.target === '_blank') return false;
    /// check if it's the same domain
    if (window.location.protocol !== element.protocol || window.location.hostname !== element.hostname) return false;
    /// check if the port is the same
    if (Utils.getPort() !== Utils.getPort(element.port)) return false;
    /// ignore case when a hash is being tacked on the current url
    if (element.href.indexOf('#') > -1) return false;
    /// in case you're trying to load the same page
    if (Utils.cleanLink(element.href) == Utils.cleanLink(location.href)) return false;
    if (element.classList.contains('no-barba')) return false;
    return true;
  },

  /**
   * Time in millisecond after the xhr request goes in timeout
   *
   * @memberOf Barba.Utils
   * @type {Number}
   * @default
   */
  xhrTimeout: 5000,

  /**
   * Start an XMLHttpRequest() and return a Promise
   *
   * @memberOf Barba.Utils
   * @param  {String} url
   * @return {Promise}
   */
  xhr: function xhr(url) {
    var deferred = this.deferred();
    var req = new XMLHttpRequest();

    req.onreadystatechange = function () {
      if (req.readyState === 4) {
        if (req.status === 200) {
          return deferred.resolve(req.responseText);
        } else {
          return deferred.reject(new Error('xhr: HTTP code is not 200'));
        }
      }
    };

    req.ontimeout = function () {
      return deferred.reject(new Error('xhr: Timeout exceeded'));
    };

    req.open('GET', url);
    req.timeout = this.xhrTimeout;
    req.setRequestHeader('x-barba', 'yes');
    req.send();

    return deferred.promise;
  },

  /**
   * Get obj and props and return a new object with the property merged
   *
   * @memberOf Barba.Utils
   * @param  {object} obj
   * @param  {object} props
   * @return {object}
   */
  extend: function extend(obj, props) {
    var newObj = Object.create(obj);

    for (var prop in props) {
      if (props.hasOwnProperty(prop)) {
        newObj[prop] = props[prop];
      }
    }

    return newObj;
  },

  /**
   * Return a new "Deferred" object
   * https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Promise.jsm/Deferred
   *
   * @return {Deferred}
   */
  deferred: function deferred() {
    return new function () {
      this.resolve = null;
      this.reject = null;

      this.promise = new Promise(function (resolve, reject) {
        this.resolve = resolve;
        this.reject = reject;
      }.bind(this));
    }();
  },

  /**
   * Return the port number normalized, eventually you can pass a string to be normalized.
   *
   * @param  {String} p
   * @return {Int} port
   */
  getPort: function getPort(p) {
    var port = typeof p !== 'undefined' ? p : window.location.port;
    var protocol = window.location.protocol;

    if (port != '') return parseInt(port);

    if (protocol === 'http:') return 80;

    if (protocol === 'https:') return 443;
  }
};

module.exports = Utils;

},{}],11:[function(require,module,exports){
'use strict';

var Dispatcher = require('../Dispatcher');
var Utils = require('./Utils');

/// VIEW
var View = module.exports = {
  extend: function extend(obj) {
    return Utils.extend(this, obj);
  },

  namespace: null,

  newStart: function newStart() {},
  newComplete: function newComplete() {},
  oldStart: function oldStart() {},
  oldComplete: function oldComplete() {},

  init: function init() {
    var _this = this;

    Dispatcher.on('stateChange', function (newStatus, oldStatus) {
      if (oldStatus && oldStatus.namespace === _this.namespace)
        // oldContainer ready to trans OUT
        _this.oldStart();
    });

    Dispatcher.on('newPageReady', function (newStatus, oldStatus, container) {
      _this.container = container;

      if (newStatus.namespace === _this.namespace)
        // newContainer is ready to trans IN
        _this.newStart();
    });

    Dispatcher.on('transitionEnd', function (newStatus, oldStatus) {
      if (newStatus.namespace === _this.namespace)
        // newContainer trans IN is complete
        _this.newComplete();

      if (oldStatus && oldStatus.namespace === _this.namespace)
        // oldContainer trans OUT is complete
        _this.oldComplete();
    });
  }
};

},{"../Dispatcher":2,"./Utils":10}],12:[function(require,module,exports){
'use strict';

document.addEventListener('DOMContentLoaded', function () {

  var lastElementClicked;
  var PrevLink = document.querySelector('a.prev');
  var NextLink = document.querySelector('a.next');

  var Pjax = require('../../src/Pjax');
  var Dispatcher = require('../../src/Dispatcher');

  Pjax.init();
  Pjax.Prefetch.init();

  Dispatcher.on('linkClicked', function (el) {
    lastElementClicked = el;
  });

  // console.log(Pjax);

  var MovePage = Pjax.Transition.extend({
    render: function render() {
      this.originalThumb = lastElementClicked;

      Promise.all([this.containerLoaded, scrollTop()]).then(movePages.bind(this));
    }
  });

  Pjax.defaultTransition = MovePage;

  function scrollTop() {
    var deferred = Pjax.Utils.deferred();
    var obj = { y: window.pageYOffset };

    TweenLite.to(obj, 0.4, {
      y: 0,
      onUpdate: function onUpdate() {
        if (obj.y === 0) {
          deferred.resolve();
        }

        window.scroll(0, obj.y);
      },
      onComplete: function onComplete() {
        deferred.resolve();
      }
    });

    return deferred.promise;
  }

  function movePages() {
    var _this = this;
    var goingForward = true;
    PrevLink.href = this.newContainer.dataset.prev;
    NextLink.href = this.newContainer.dataset.next;

    if (getNewPageFile() === this.oldContainer.dataset.prev) {
      goingForward = false;
    }

    TweenLite.set(this.newContainer, {
      visibility: 'visible',
      xPercent: goingForward ? 100 : -100,
      position: 'fixed',
      left: 0,
      top: 0,
      right: 0
    });

    TweenLite.to(this.oldContainer, 0.6, { xPercent: goingForward ? -100 : 100 });
    TweenLite.to(this.newContainer, 0.6, { xPercent: 0, onComplete: function onComplete() {
        TweenLite.set(_this.newContainer, { clearProps: 'all' });
        _this.resolve();
      }
    });
  }

  function updateLinks() {
    PrevLink.href = this.newContainer.dataset.prev;
    NextLink.href = this.newContainer.dataset.next;
  }

  function getNewPageFile() {
    return Pjax.History.currentStatus().url.split('/').pop();
  }
});

},{"../../src/Dispatcher":2,"../../src/Pjax":3}]},{},[12])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92NS4xMS4xL2xpYi9ub2RlX21vZHVsZXMvZ2xvYmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL25hdGl2ZS1wcm9taXNlLW9ubHkvbGliL25wby5zcmMuanMiLCJzcmMvRGlzcGF0Y2hlci5qcyIsInNyYy9QamF4LmpzIiwic3JjL1BqYXgvQ2FjaGUuanMiLCJzcmMvUGpheC9Eb20uanMiLCJzcmMvUGpheC9IaWRlU2hvd1RyYW5zaXRpb24uanMiLCJzcmMvUGpheC9IaXN0b3J5LmpzIiwic3JjL1BqYXgvUHJlZmV0Y2guanMiLCJzcmMvUGpheC9UcmFuc2l0aW9uLmpzIiwic3JjL1BqYXgvVXRpbHMuanMiLCJzcmMvUGpheC9WaWV3LmpzIiwidGVzdC9uZXh0cHJldi9tYWluLmVzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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LFVBQWQsd0JBQTJCO0FBQzlELGtCQUFVLEdBQVYsQ0FBYyxNQUFNLFlBQXBCLEVBQWtDLEVBQUMsWUFBWSxLQUFiLEVBQWxDO0FBQ0EsY0FBTSxPQUFOO0FBQ0Q7QUFIb0MsS0FBckM7QUFJRDs7QUFFRCxXQUFTLFdBQVQsR0FBdUI7QUFDckIsYUFBUyxJQUFULEdBQWdCLEtBQUssWUFBTCxDQUFrQixPQUFsQixDQUEwQixJQUExQztBQUNBLGFBQVMsSUFBVCxHQUFnQixLQUFLLFlBQUwsQ0FBa0IsT0FBbEIsQ0FBMEIsSUFBMUM7QUFDRDs7QUFFRCxXQUFTLGNBQVQsR0FBMkI7QUFDekIsV0FBTyxLQUFLLE9BQUwsQ0FBYSxhQUFiLEdBQTZCLEdBQTdCLENBQWlDLEtBQWpDLENBQXVDLEdBQXZDLEVBQTRDLEdBQTVDLEVBQVA7QUFDRDtBQUVGLENBdEZEIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qISBOYXRpdmUgUHJvbWlzZSBPbmx5XG4gICAgdjAuOC4xIChjKSBLeWxlIFNpbXBzb25cbiAgICBNSVQgTGljZW5zZTogaHR0cDovL2dldGlmeS5taXQtbGljZW5zZS5vcmdcbiovXG5cbihmdW5jdGlvbiBVTUQobmFtZSxjb250ZXh0LGRlZmluaXRpb24pe1xuXHQvLyBzcGVjaWFsIGZvcm0gb2YgVU1EIGZvciBwb2x5ZmlsbGluZyBhY3Jvc3MgZXZpcm9ubWVudHNcblx0Y29udGV4dFtuYW1lXSA9IGNvbnRleHRbbmFtZV0gfHwgZGVmaW5pdGlvbigpO1xuXHRpZiAodHlwZW9mIG1vZHVsZSAhPSBcInVuZGVmaW5lZFwiICYmIG1vZHVsZS5leHBvcnRzKSB7IG1vZHVsZS5leHBvcnRzID0gY29udGV4dFtuYW1lXTsgfVxuXHRlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09IFwiZnVuY3Rpb25cIiAmJiBkZWZpbmUuYW1kKSB7IGRlZmluZShmdW5jdGlvbiAkQU1EJCgpeyByZXR1cm4gY29udGV4dFtuYW1lXTsgfSk7IH1cbn0pKFwiUHJvbWlzZVwiLHR5cGVvZiBnbG9iYWwgIT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHRoaXMsZnVuY3Rpb24gREVGKCl7XG5cdC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG5cdFwidXNlIHN0cmljdFwiO1xuXG5cdHZhciBidWlsdEluUHJvcCwgY3ljbGUsIHNjaGVkdWxpbmdfcXVldWUsXG5cdFx0VG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLFxuXHRcdHRpbWVyID0gKHR5cGVvZiBzZXRJbW1lZGlhdGUgIT0gXCJ1bmRlZmluZWRcIikgP1xuXHRcdFx0ZnVuY3Rpb24gdGltZXIoZm4pIHsgcmV0dXJuIHNldEltbWVkaWF0ZShmbik7IH0gOlxuXHRcdFx0c2V0VGltZW91dFxuXHQ7XG5cblx0Ly8gZGFtbWl0LCBJRTguXG5cdHRyeSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHt9LFwieFwiLHt9KTtcblx0XHRidWlsdEluUHJvcCA9IGZ1bmN0aW9uIGJ1aWx0SW5Qcm9wKG9iaixuYW1lLHZhbCxjb25maWcpIHtcblx0XHRcdHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLG5hbWUse1xuXHRcdFx0XHR2YWx1ZTogdmFsLFxuXHRcdFx0XHR3cml0YWJsZTogdHJ1ZSxcblx0XHRcdFx0Y29uZmlndXJhYmxlOiBjb25maWcgIT09IGZhbHNlXG5cdFx0XHR9KTtcblx0XHR9O1xuXHR9XG5cdGNhdGNoIChlcnIpIHtcblx0XHRidWlsdEluUHJvcCA9IGZ1bmN0aW9uIGJ1aWx0SW5Qcm9wKG9iaixuYW1lLHZhbCkge1xuXHRcdFx0b2JqW25hbWVdID0gdmFsO1xuXHRcdFx0cmV0dXJuIG9iajtcblx0XHR9O1xuXHR9XG5cblx0Ly8gTm90ZTogdXNpbmcgYSBxdWV1ZSBpbnN0ZWFkIG9mIGFycmF5IGZvciBlZmZpY2llbmN5XG5cdHNjaGVkdWxpbmdfcXVldWUgPSAoZnVuY3Rpb24gUXVldWUoKSB7XG5cdFx0dmFyIGZpcnN0LCBsYXN0LCBpdGVtO1xuXG5cdFx0ZnVuY3Rpb24gSXRlbShmbixzZWxmKSB7XG5cdFx0XHR0aGlzLmZuID0gZm47XG5cdFx0XHR0aGlzLnNlbGYgPSBzZWxmO1xuXHRcdFx0dGhpcy5uZXh0ID0gdm9pZCAwO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRhZGQ6IGZ1bmN0aW9uIGFkZChmbixzZWxmKSB7XG5cdFx0XHRcdGl0ZW0gPSBuZXcgSXRlbShmbixzZWxmKTtcblx0XHRcdFx0aWYgKGxhc3QpIHtcblx0XHRcdFx0XHRsYXN0Lm5leHQgPSBpdGVtO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGZpcnN0ID0gaXRlbTtcblx0XHRcdFx0fVxuXHRcdFx0XHRsYXN0ID0gaXRlbTtcblx0XHRcdFx0aXRlbSA9IHZvaWQgMDtcblx0XHRcdH0sXG5cdFx0XHRkcmFpbjogZnVuY3Rpb24gZHJhaW4oKSB7XG5cdFx0XHRcdHZhciBmID0gZmlyc3Q7XG5cdFx0XHRcdGZpcnN0ID0gbGFzdCA9IGN5Y2xlID0gdm9pZCAwO1xuXG5cdFx0XHRcdHdoaWxlIChmKSB7XG5cdFx0XHRcdFx0Zi5mbi5jYWxsKGYuc2VsZik7XG5cdFx0XHRcdFx0ZiA9IGYubmV4dDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH0pKCk7XG5cblx0ZnVuY3Rpb24gc2NoZWR1bGUoZm4sc2VsZikge1xuXHRcdHNjaGVkdWxpbmdfcXVldWUuYWRkKGZuLHNlbGYpO1xuXHRcdGlmICghY3ljbGUpIHtcblx0XHRcdGN5Y2xlID0gdGltZXIoc2NoZWR1bGluZ19xdWV1ZS5kcmFpbik7XG5cdFx0fVxuXHR9XG5cblx0Ly8gcHJvbWlzZSBkdWNrIHR5cGluZ1xuXHRmdW5jdGlvbiBpc1RoZW5hYmxlKG8pIHtcblx0XHR2YXIgX3RoZW4sIG9fdHlwZSA9IHR5cGVvZiBvO1xuXG5cdFx0aWYgKG8gIT0gbnVsbCAmJlxuXHRcdFx0KFxuXHRcdFx0XHRvX3R5cGUgPT0gXCJvYmplY3RcIiB8fCBvX3R5cGUgPT0gXCJmdW5jdGlvblwiXG5cdFx0XHQpXG5cdFx0KSB7XG5cdFx0XHRfdGhlbiA9IG8udGhlbjtcblx0XHR9XG5cdFx0cmV0dXJuIHR5cGVvZiBfdGhlbiA9PSBcImZ1bmN0aW9uXCIgPyBfdGhlbiA6IGZhbHNlO1xuXHR9XG5cblx0ZnVuY3Rpb24gbm90aWZ5KCkge1xuXHRcdGZvciAodmFyIGk9MDsgaTx0aGlzLmNoYWluLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRub3RpZnlJc29sYXRlZChcblx0XHRcdFx0dGhpcyxcblx0XHRcdFx0KHRoaXMuc3RhdGUgPT09IDEpID8gdGhpcy5jaGFpbltpXS5zdWNjZXNzIDogdGhpcy5jaGFpbltpXS5mYWlsdXJlLFxuXHRcdFx0XHR0aGlzLmNoYWluW2ldXG5cdFx0XHQpO1xuXHRcdH1cblx0XHR0aGlzLmNoYWluLmxlbmd0aCA9IDA7XG5cdH1cblxuXHQvLyBOT1RFOiBUaGlzIGlzIGEgc2VwYXJhdGUgZnVuY3Rpb24gdG8gaXNvbGF0ZVxuXHQvLyB0aGUgYHRyeS4uY2F0Y2hgIHNvIHRoYXQgb3RoZXIgY29kZSBjYW4gYmVcblx0Ly8gb3B0aW1pemVkIGJldHRlclxuXHRmdW5jdGlvbiBub3RpZnlJc29sYXRlZChzZWxmLGNiLGNoYWluKSB7XG5cdFx0dmFyIHJldCwgX3RoZW47XG5cdFx0dHJ5IHtcblx0XHRcdGlmIChjYiA9PT0gZmFsc2UpIHtcblx0XHRcdFx0Y2hhaW4ucmVqZWN0KHNlbGYubXNnKTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRpZiAoY2IgPT09IHRydWUpIHtcblx0XHRcdFx0XHRyZXQgPSBzZWxmLm1zZztcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRyZXQgPSBjYi5jYWxsKHZvaWQgMCxzZWxmLm1zZyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAocmV0ID09PSBjaGFpbi5wcm9taXNlKSB7XG5cdFx0XHRcdFx0Y2hhaW4ucmVqZWN0KFR5cGVFcnJvcihcIlByb21pc2UtY2hhaW4gY3ljbGVcIikpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKF90aGVuID0gaXNUaGVuYWJsZShyZXQpKSB7XG5cdFx0XHRcdFx0X3RoZW4uY2FsbChyZXQsY2hhaW4ucmVzb2x2ZSxjaGFpbi5yZWplY3QpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGNoYWluLnJlc29sdmUocmV0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRjYXRjaCAoZXJyKSB7XG5cdFx0XHRjaGFpbi5yZWplY3QoZXJyKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiByZXNvbHZlKG1zZykge1xuXHRcdHZhciBfdGhlbiwgc2VsZiA9IHRoaXM7XG5cblx0XHQvLyBhbHJlYWR5IHRyaWdnZXJlZD9cblx0XHRpZiAoc2VsZi50cmlnZ2VyZWQpIHsgcmV0dXJuOyB9XG5cblx0XHRzZWxmLnRyaWdnZXJlZCA9IHRydWU7XG5cblx0XHQvLyB1bndyYXBcblx0XHRpZiAoc2VsZi5kZWYpIHtcblx0XHRcdHNlbGYgPSBzZWxmLmRlZjtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0aWYgKF90aGVuID0gaXNUaGVuYWJsZShtc2cpKSB7XG5cdFx0XHRcdHNjaGVkdWxlKGZ1bmN0aW9uKCl7XG5cdFx0XHRcdFx0dmFyIGRlZl93cmFwcGVyID0gbmV3IE1ha2VEZWZXcmFwcGVyKHNlbGYpO1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRfdGhlbi5jYWxsKG1zZyxcblx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gJHJlc29sdmUkKCl7IHJlc29sdmUuYXBwbHkoZGVmX3dyYXBwZXIsYXJndW1lbnRzKTsgfSxcblx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gJHJlamVjdCQoKXsgcmVqZWN0LmFwcGx5KGRlZl93cmFwcGVyLGFyZ3VtZW50cyk7IH1cblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNhdGNoIChlcnIpIHtcblx0XHRcdFx0XHRcdHJlamVjdC5jYWxsKGRlZl93cmFwcGVyLGVycik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHNlbGYubXNnID0gbXNnO1xuXHRcdFx0XHRzZWxmLnN0YXRlID0gMTtcblx0XHRcdFx0aWYgKHNlbGYuY2hhaW4ubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdHNjaGVkdWxlKG5vdGlmeSxzZWxmKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRjYXRjaCAoZXJyKSB7XG5cdFx0XHRyZWplY3QuY2FsbChuZXcgTWFrZURlZldyYXBwZXIoc2VsZiksZXJyKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiByZWplY3QobXNnKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdFx0Ly8gYWxyZWFkeSB0cmlnZ2VyZWQ/XG5cdFx0aWYgKHNlbGYudHJpZ2dlcmVkKSB7IHJldHVybjsgfVxuXG5cdFx0c2VsZi50cmlnZ2VyZWQgPSB0cnVlO1xuXG5cdFx0Ly8gdW53cmFwXG5cdFx0aWYgKHNlbGYuZGVmKSB7XG5cdFx0XHRzZWxmID0gc2VsZi5kZWY7XG5cdFx0fVxuXG5cdFx0c2VsZi5tc2cgPSBtc2c7XG5cdFx0c2VsZi5zdGF0ZSA9IDI7XG5cdFx0aWYgKHNlbGYuY2hhaW4ubGVuZ3RoID4gMCkge1xuXHRcdFx0c2NoZWR1bGUobm90aWZ5LHNlbGYpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGl0ZXJhdGVQcm9taXNlcyhDb25zdHJ1Y3RvcixhcnIscmVzb2x2ZXIscmVqZWN0ZXIpIHtcblx0XHRmb3IgKHZhciBpZHg9MDsgaWR4PGFyci5sZW5ndGg7IGlkeCsrKSB7XG5cdFx0XHQoZnVuY3Rpb24gSUlGRShpZHgpe1xuXHRcdFx0XHRDb25zdHJ1Y3Rvci5yZXNvbHZlKGFycltpZHhdKVxuXHRcdFx0XHQudGhlbihcblx0XHRcdFx0XHRmdW5jdGlvbiAkcmVzb2x2ZXIkKG1zZyl7XG5cdFx0XHRcdFx0XHRyZXNvbHZlcihpZHgsbXNnKTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHJlamVjdGVyXG5cdFx0XHRcdCk7XG5cdFx0XHR9KShpZHgpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIE1ha2VEZWZXcmFwcGVyKHNlbGYpIHtcblx0XHR0aGlzLmRlZiA9IHNlbGY7XG5cdFx0dGhpcy50cmlnZ2VyZWQgPSBmYWxzZTtcblx0fVxuXG5cdGZ1bmN0aW9uIE1ha2VEZWYoc2VsZikge1xuXHRcdHRoaXMucHJvbWlzZSA9IHNlbGY7XG5cdFx0dGhpcy5zdGF0ZSA9IDA7XG5cdFx0dGhpcy50cmlnZ2VyZWQgPSBmYWxzZTtcblx0XHR0aGlzLmNoYWluID0gW107XG5cdFx0dGhpcy5tc2cgPSB2b2lkIDA7XG5cdH1cblxuXHRmdW5jdGlvbiBQcm9taXNlKGV4ZWN1dG9yKSB7XG5cdFx0aWYgKHR5cGVvZiBleGVjdXRvciAhPSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdHRocm93IFR5cGVFcnJvcihcIk5vdCBhIGZ1bmN0aW9uXCIpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9fTlBPX18gIT09IDApIHtcblx0XHRcdHRocm93IFR5cGVFcnJvcihcIk5vdCBhIHByb21pc2VcIik7XG5cdFx0fVxuXG5cdFx0Ly8gaW5zdGFuY2Ugc2hhZG93aW5nIHRoZSBpbmhlcml0ZWQgXCJicmFuZFwiXG5cdFx0Ly8gdG8gc2lnbmFsIGFuIGFscmVhZHkgXCJpbml0aWFsaXplZFwiIHByb21pc2Vcblx0XHR0aGlzLl9fTlBPX18gPSAxO1xuXG5cdFx0dmFyIGRlZiA9IG5ldyBNYWtlRGVmKHRoaXMpO1xuXG5cdFx0dGhpc1tcInRoZW5cIl0gPSBmdW5jdGlvbiB0aGVuKHN1Y2Nlc3MsZmFpbHVyZSkge1xuXHRcdFx0dmFyIG8gPSB7XG5cdFx0XHRcdHN1Y2Nlc3M6IHR5cGVvZiBzdWNjZXNzID09IFwiZnVuY3Rpb25cIiA/IHN1Y2Nlc3MgOiB0cnVlLFxuXHRcdFx0XHRmYWlsdXJlOiB0eXBlb2YgZmFpbHVyZSA9PSBcImZ1bmN0aW9uXCIgPyBmYWlsdXJlIDogZmFsc2Vcblx0XHRcdH07XG5cdFx0XHQvLyBOb3RlOiBgdGhlbiguLilgIGl0c2VsZiBjYW4gYmUgYm9ycm93ZWQgdG8gYmUgdXNlZCBhZ2FpbnN0XG5cdFx0XHQvLyBhIGRpZmZlcmVudCBwcm9taXNlIGNvbnN0cnVjdG9yIGZvciBtYWtpbmcgdGhlIGNoYWluZWQgcHJvbWlzZSxcblx0XHRcdC8vIGJ5IHN1YnN0aXR1dGluZyBhIGRpZmZlcmVudCBgdGhpc2AgYmluZGluZy5cblx0XHRcdG8ucHJvbWlzZSA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKGZ1bmN0aW9uIGV4dHJhY3RDaGFpbihyZXNvbHZlLHJlamVjdCkge1xuXHRcdFx0XHRpZiAodHlwZW9mIHJlc29sdmUgIT0gXCJmdW5jdGlvblwiIHx8IHR5cGVvZiByZWplY3QgIT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdFx0dGhyb3cgVHlwZUVycm9yKFwiTm90IGEgZnVuY3Rpb25cIik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRvLnJlc29sdmUgPSByZXNvbHZlO1xuXHRcdFx0XHRvLnJlamVjdCA9IHJlamVjdDtcblx0XHRcdH0pO1xuXHRcdFx0ZGVmLmNoYWluLnB1c2gobyk7XG5cblx0XHRcdGlmIChkZWYuc3RhdGUgIT09IDApIHtcblx0XHRcdFx0c2NoZWR1bGUobm90aWZ5LGRlZik7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBvLnByb21pc2U7XG5cdFx0fTtcblx0XHR0aGlzW1wiY2F0Y2hcIl0gPSBmdW5jdGlvbiAkY2F0Y2gkKGZhaWx1cmUpIHtcblx0XHRcdHJldHVybiB0aGlzLnRoZW4odm9pZCAwLGZhaWx1cmUpO1xuXHRcdH07XG5cblx0XHR0cnkge1xuXHRcdFx0ZXhlY3V0b3IuY2FsbChcblx0XHRcdFx0dm9pZCAwLFxuXHRcdFx0XHRmdW5jdGlvbiBwdWJsaWNSZXNvbHZlKG1zZyl7XG5cdFx0XHRcdFx0cmVzb2x2ZS5jYWxsKGRlZixtc2cpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRmdW5jdGlvbiBwdWJsaWNSZWplY3QobXNnKSB7XG5cdFx0XHRcdFx0cmVqZWN0LmNhbGwoZGVmLG1zZyk7XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fVxuXHRcdGNhdGNoIChlcnIpIHtcblx0XHRcdHJlamVjdC5jYWxsKGRlZixlcnIpO1xuXHRcdH1cblx0fVxuXG5cdHZhciBQcm9taXNlUHJvdG90eXBlID0gYnVpbHRJblByb3Aoe30sXCJjb25zdHJ1Y3RvclwiLFByb21pc2UsXG5cdFx0Lypjb25maWd1cmFibGU9Ki9mYWxzZVxuXHQpO1xuXG5cdC8vIE5vdGU6IEFuZHJvaWQgNCBjYW5ub3QgdXNlIGBPYmplY3QuZGVmaW5lUHJvcGVydHkoLi4pYCBoZXJlXG5cdFByb21pc2UucHJvdG90eXBlID0gUHJvbWlzZVByb3RvdHlwZTtcblxuXHQvLyBidWlsdC1pbiBcImJyYW5kXCIgdG8gc2lnbmFsIGFuIFwidW5pbml0aWFsaXplZFwiIHByb21pc2Vcblx0YnVpbHRJblByb3AoUHJvbWlzZVByb3RvdHlwZSxcIl9fTlBPX19cIiwwLFxuXHRcdC8qY29uZmlndXJhYmxlPSovZmFsc2Vcblx0KTtcblxuXHRidWlsdEluUHJvcChQcm9taXNlLFwicmVzb2x2ZVwiLGZ1bmN0aW9uIFByb21pc2UkcmVzb2x2ZShtc2cpIHtcblx0XHR2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG5cdFx0Ly8gc3BlYyBtYW5kYXRlZCBjaGVja3Ncblx0XHQvLyBub3RlOiBiZXN0IFwiaXNQcm9taXNlXCIgY2hlY2sgdGhhdCdzIHByYWN0aWNhbCBmb3Igbm93XG5cdFx0aWYgKG1zZyAmJiB0eXBlb2YgbXNnID09IFwib2JqZWN0XCIgJiYgbXNnLl9fTlBPX18gPT09IDEpIHtcblx0XHRcdHJldHVybiBtc2c7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBDb25zdHJ1Y3RvcihmdW5jdGlvbiBleGVjdXRvcihyZXNvbHZlLHJlamVjdCl7XG5cdFx0XHRpZiAodHlwZW9mIHJlc29sdmUgIT0gXCJmdW5jdGlvblwiIHx8IHR5cGVvZiByZWplY3QgIT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdHRocm93IFR5cGVFcnJvcihcIk5vdCBhIGZ1bmN0aW9uXCIpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXNvbHZlKG1zZyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdGJ1aWx0SW5Qcm9wKFByb21pc2UsXCJyZWplY3RcIixmdW5jdGlvbiBQcm9taXNlJHJlamVjdChtc2cpIHtcblx0XHRyZXR1cm4gbmV3IHRoaXMoZnVuY3Rpb24gZXhlY3V0b3IocmVzb2x2ZSxyZWplY3Qpe1xuXHRcdFx0aWYgKHR5cGVvZiByZXNvbHZlICE9IFwiZnVuY3Rpb25cIiB8fCB0eXBlb2YgcmVqZWN0ICE9IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHR0aHJvdyBUeXBlRXJyb3IoXCJOb3QgYSBmdW5jdGlvblwiKTtcblx0XHRcdH1cblxuXHRcdFx0cmVqZWN0KG1zZyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdGJ1aWx0SW5Qcm9wKFByb21pc2UsXCJhbGxcIixmdW5jdGlvbiBQcm9taXNlJGFsbChhcnIpIHtcblx0XHR2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG5cdFx0Ly8gc3BlYyBtYW5kYXRlZCBjaGVja3Ncblx0XHRpZiAoVG9TdHJpbmcuY2FsbChhcnIpICE9IFwiW29iamVjdCBBcnJheV1cIikge1xuXHRcdFx0cmV0dXJuIENvbnN0cnVjdG9yLnJlamVjdChUeXBlRXJyb3IoXCJOb3QgYW4gYXJyYXlcIikpO1xuXHRcdH1cblx0XHRpZiAoYXJyLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIENvbnN0cnVjdG9yLnJlc29sdmUoW10pO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgQ29uc3RydWN0b3IoZnVuY3Rpb24gZXhlY3V0b3IocmVzb2x2ZSxyZWplY3Qpe1xuXHRcdFx0aWYgKHR5cGVvZiByZXNvbHZlICE9IFwiZnVuY3Rpb25cIiB8fCB0eXBlb2YgcmVqZWN0ICE9IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHR0aHJvdyBUeXBlRXJyb3IoXCJOb3QgYSBmdW5jdGlvblwiKTtcblx0XHRcdH1cblxuXHRcdFx0dmFyIGxlbiA9IGFyci5sZW5ndGgsIG1zZ3MgPSBBcnJheShsZW4pLCBjb3VudCA9IDA7XG5cblx0XHRcdGl0ZXJhdGVQcm9taXNlcyhDb25zdHJ1Y3RvcixhcnIsZnVuY3Rpb24gcmVzb2x2ZXIoaWR4LG1zZykge1xuXHRcdFx0XHRtc2dzW2lkeF0gPSBtc2c7XG5cdFx0XHRcdGlmICgrK2NvdW50ID09PSBsZW4pIHtcblx0XHRcdFx0XHRyZXNvbHZlKG1zZ3MpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LHJlamVjdCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdGJ1aWx0SW5Qcm9wKFByb21pc2UsXCJyYWNlXCIsZnVuY3Rpb24gUHJvbWlzZSRyYWNlKGFycikge1xuXHRcdHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cblx0XHQvLyBzcGVjIG1hbmRhdGVkIGNoZWNrc1xuXHRcdGlmIChUb1N0cmluZy5jYWxsKGFycikgIT0gXCJbb2JqZWN0IEFycmF5XVwiKSB7XG5cdFx0XHRyZXR1cm4gQ29uc3RydWN0b3IucmVqZWN0KFR5cGVFcnJvcihcIk5vdCBhbiBhcnJheVwiKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBDb25zdHJ1Y3RvcihmdW5jdGlvbiBleGVjdXRvcihyZXNvbHZlLHJlamVjdCl7XG5cdFx0XHRpZiAodHlwZW9mIHJlc29sdmUgIT0gXCJmdW5jdGlvblwiIHx8IHR5cGVvZiByZWplY3QgIT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdHRocm93IFR5cGVFcnJvcihcIk5vdCBhIGZ1bmN0aW9uXCIpO1xuXHRcdFx0fVxuXG5cdFx0XHRpdGVyYXRlUHJvbWlzZXMoQ29uc3RydWN0b3IsYXJyLGZ1bmN0aW9uIHJlc29sdmVyKGlkeCxtc2cpe1xuXHRcdFx0XHRyZXNvbHZlKG1zZyk7XG5cdFx0XHR9LHJlamVjdCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHJldHVybiBQcm9taXNlO1xufSk7XG4iLCIvKipcbiAqIExpdHRsZSBEaXNwYXRjaGVyIGluc3BpcmVkIGJ5IE1pY3JvRXZlbnQuanNcbiAqXG4gKiBAbmFtZXNwYWNlIEJhcmJhLkRpc3BhdGNoZXJcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbnZhciBEaXNwYXRjaGVyID0ge1xuICAvKipcbiAgICogRXZlbnQgYXJyYXlcbiAgICpcbiAgICogQG1lbWJlck9mIEJhcmJhLkRpc3BhdGNoZXJcbiAgICogQHJlYWRPbmx5XG4gICAqIEB0eXBlIHtPYmplY3R9XG4gICAqL1xuICBldmVudHM6IHt9LFxuXG4gIC8qKlxuICAgKiBCaW5kIGEgY2FsbGJhY2sgdG8gYW4gZXZlbnRcbiAgICpcbiAgICogQG1lbWJlck9mIEJhcmJhLkRpc3BhdGNoZXJcbiAgICogQHBhcmFtICB7U3RyaW5nfSBldmVudE5hbWVcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGZ1bmN0aW9uXG4gICAqL1xuICBvbihlLCBmKSB7XG4gICAgdGhpcy5ldmVudHNbZV0gPSB0aGlzLmV2ZW50c1tlXSB8fCBbXTtcbiAgICB0aGlzLmV2ZW50c1tlXS5wdXNoKGYpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBVbmJpbmQgZXZlbnRcbiAgICpcbiAgICogQG1lbWJlck9mIEJhcmJhLkRpc3BhdGNoZXJcbiAgICogQHBhcmFtICB7U3RyaW5nfSBldmVudE5hbWVcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGZ1bmN0aW9uXG4gICAqL1xuICBvZmYoZSwgZikge1xuICAgIGlmKGUgaW4gdGhpcy5ldmVudHMgPT09IGZhbHNlKVxuICAgICAgcmV0dXJuO1xuXG4gICAgdGhpcy5ldmVudHNbZV0uc3BsaWNlKHRoaXMuZXZlbnRzW2VdLmluZGV4T2YoZiksIDEpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBGaXJlIHRoZSBldmVudCBydW5uaW5nIGFsbCB0aGUgZXZlbnQgYXNzb2NpYXRlZFxuICAgKlxuICAgKiBAbWVtYmVyT2YgQmFyYmEuRGlzcGF0Y2hlclxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IGV2ZW50TmFtZVxuICAgKiBAcGFyYW0gey4uLip9IGFyZ3NcbiAgICovXG4gIHRyaWdnZXIoZSkgey8vZSwgLi4uYXJnc1xuICAgIGlmIChlIGluIHRoaXMuZXZlbnRzID09PSBmYWxzZSlcbiAgICAgIHJldHVybjtcblxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCB0aGlzLmV2ZW50c1tlXS5sZW5ndGg7IGkrKyl7XG4gICAgICB0aGlzLmV2ZW50c1tlXVtpXS5hcHBseSh0aGlzLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICB9XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRGlzcGF0Y2hlcjtcbiIsIi8vLyBQcm9taXNlIHBvbHlmaWxsIGh0dHBzOi8vZ2l0aHViLmNvbS90YXlsb3JoYWtlcy9wcm9taXNlLXBvbHlmaWxsXG4vLy8gYWx0ZXJuYXRpdmUgLS0gaHR0cHM6Ly9naXRodWIuY29tL2dldGlmeS9uYXRpdmUtcHJvbWlzZS1vbmx5XG5pZiAodHlwZW9mIFByb21pc2UgIT09ICdmdW5jdGlvbicpIHsgd2luZG93LlByb21pc2UgPSByZXF1aXJlKCduYXRpdmUtcHJvbWlzZS1vbmx5Jyk7IH1cblxuLy8gZ2VuZXJhbFxudmFyIERpc3BhdGNoZXIgICAgICAgID0gcmVxdWlyZSgnLi9EaXNwYXRjaGVyJyk7XG5cbi8vIHBqYXggc3BlY2lmaWMgc3R1ZmZcbnZhciBDYWNoZSAgICAgID0gcmVxdWlyZSgnLi9QamF4L0NhY2hlJyk7XG52YXIgRG9tICAgICAgICA9IHJlcXVpcmUoJy4vUGpheC9Eb20nKTtcbnZhciBIaXN0b3J5ICAgID0gcmVxdWlyZSgnLi9QamF4L0hpc3RvcnknKTtcbnZhciBQcmVmZXRjaCAgID0gcmVxdWlyZSgnLi9QamF4L1ByZWZldGNoJyk7XG52YXIgVHJhbnNpdGlvbiA9IHJlcXVpcmUoJy4vUGpheC9UcmFuc2l0aW9uJyk7XG52YXIgVmlldyAgICAgICA9IHJlcXVpcmUoJy4vUGpheC9WaWV3Jyk7XG52YXIgVXRpbHMgICAgICA9IHJlcXVpcmUoJy4vUGpheC9VdGlscycpO1xuXG5cbi8vLyBnZXQgY3VycmVudCBVUkxcbmZ1bmN0aW9uIGdldEN1cnJlbnRVcmwoKSB7IHJldHVybiBVdGlscy5jbGVhbkxpbmsoIFV0aWxzLmdldEN1cnJlbnRVcmwoKSApOyB9XG5cbi8vIFRPRE86IHJlbmFtZSB0aGUgZm9sbG93aW5nIHR3byBmdW5jdGlvbnNcbi8vLyBnbyB0b1xuLy8gZnVuY3Rpb24gZ29Ubyh1cmwpIHtcbi8vICAgd2luZG93Lmhpc3RvcnkucHVzaFN0YXRlKG51bGwsIG51bGwsIHVybCk7XG4vLyAgIG9uU3RhdGVDaGFuZ2UoKTtcbi8vIH1cbi8vLyBmb3JjZSBnbyB0b1xuZnVuY3Rpb24gZm9yY2VHb1RvKHVybCkgeyB3aW5kb3cubG9jYXRpb24gPSB1cmw7IH1cblxuLy8vIGxpbmtDbGljayBoYW5kbGVyXG5mdW5jdGlvbiBvbkxpbmtDbGljayhldmVudCkge1xuICAvLyByZXNvbHZlIHRoZSBlbGVtZW50XG4gIHZhciBlbGVtZW50ID0gZXZlbnQudGFyZ2V0O1xuICB3aGlsZSAoZWxlbWVudCAmJiAhZWxlbWVudC5ocmVmKSB7IGVsZW1lbnQgPSBlbGVtZW50LnBhcmVudE5vZGU7IH1cbiAgLy8gY2hlY2sgaWYgZWxlbWVudCBpcyB2YWxpZFxuICBpZiAoVXRpbHMudmFsaWRMaW5rKGVsZW1lbnQsIGV2ZW50KSkge1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgLy8gZmlyZSBhbmQgdXBkYXRlXG4gICAgRGlzcGF0Y2hlci50cmlnZ2VyKCdsaW5rQ2xpY2snLCBlbGVtZW50KTtcbiAgICB3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUobnVsbCwgbnVsbCwgZWxlbWVudC5ocmVmKTtcbiAgICBvblN0YXRlQ2hhbmdlKCk7XG4gIH1cbn1cblxuLy8vIHN0YXRlQ2hhbmdlIGhhbmRsZXJcbmZ1bmN0aW9uIG9uU3RhdGVDaGFuZ2UoYXJnKSB7XG4gIC8vIGdldCBuZXcgVVJMXG4gIHZhciBuZXdVcmwgPSBnZXRDdXJyZW50VXJsKCk7XG4gIC8vIGJhaWwgb3V0LCBpZiBjdXJyZW50IFVSTCBpcyBzYW1lIGFzIG5ldyBVUkxcbiAgaWYgKEhpc3RvcnkuY3VycmVudFN0YXR1cygpLnVybCA9PT0gbmV3VXJsKSByZXR1cm4gZmFsc2U7XG4gIC8vIGNoZWNrIGlmIHRyYW5zaXRpb24gaW4gcHJvZ3Jlc3NcbiAgaWYgKFBqYXgudHJhbnNpdGlvbkluUHJvZ3Jlc3MpIHtcbiAgICAvLy8gaWYgdHJhbnMgaW4gcHJvZywgZm9yY2UgZ28gdG8gbmV3IFVSTFxuICAgIC8vLyBOQi4gdGhpcyBpcyB3aGVyZSB3ZSdkIGhhdmUgdG8gY2FuY2VsIHRoZSBjdXJyZW50IHRyYW5zaXRpb24gYW5kIHN0YXJ0IGFub3RoZXIgb25lXG4gICAgZm9yY2VHb1RvKG5ld1VybCk7XG4gIH1cbiAgLy8gb3RoZXJ3aXNlLi4uXG4gIC8vIGZpcmUgaW50ZXJuYWwgZXZlbnRzXG4gIERpc3BhdGNoZXIudHJpZ2dlcignc3RhdGVDaGFuZ2UnLCBIaXN0b3J5LmN1cnJlbnRTdGF0dXMoKSwgSGlzdG9yeS5wcmV2U3RhdHVzKCkpO1xuICAvLyBhZGQgVVJMIHRvIGludGVybmFsIGhpc3RvcnkgbWFuYWdlclxuICBIaXN0b3J5LmFkZChuZXdVcmwpO1xuICAvLyBnZXQgdGhlIHByb21pc2UgZm9yIHRoZSBuZXcgY29udGFpbmVyXG4gIHZhciBnb3RDb250YWluZXIgPSBQamF4LmxvYWQobmV3VXJsKTtcbiAgLy8gdGhpcyBzaG91bGQgbm90IGF0IGFsbCBiZSBuZWNlc3NhcnlcbiAgdmFyIHRyYW5zaXRpb24gPSBPYmplY3QuY3JlYXRlKFBqYXguZ2V0VHJhbnNpdGlvbigpKTtcbiAgUGpheC50cmFuc2l0aW9uSW5Qcm9ncmVzcyA9IHRydWU7XG4gIHZhciB0cmFuc2l0aW9uSW5zdGFuY2UgPSB0cmFuc2l0aW9uLmluaXQoXG4gICAgRG9tLmdldENvbnRhaW5lcigpLFxuICAgIGdvdENvbnRhaW5lclxuICApO1xuICBnb3RDb250YWluZXIudGhlbiggb25Db250YWluZXJMb2FkICk7XG4gIHRyYW5zaXRpb25JbnN0YW5jZS50aGVuKCBvblRyYW5zaXRpb25FbmQgKTtcbn1cblxuLy8vIGNvbnRhaW5lckxvYWQgaGFuZGxlclxuZnVuY3Rpb24gb25Db250YWluZXJMb2FkKGNvbnRhaW5lcikge1xuICB2YXIgY3VycmVudFN0YXR1cyA9IEhpc3RvcnkuY3VycmVudFN0YXR1cygpO1xuICBjdXJyZW50U3RhdHVzLm5hbWVzcGFjZSA9IERvbS5nZXROYW1lc3BhY2UoY29udGFpbmVyKTtcbiAgRGlzcGF0Y2hlci50cmlnZ2VyKCduZXdQYWdlUmVhZHknLFxuICAgIEhpc3RvcnkuY3VycmVudFN0YXR1cygpLFxuICAgIEhpc3RvcnkucHJldlN0YXR1cygpLFxuICAgIGNvbnRhaW5lclxuICApO1xufVxuXG4vLy8gdHJhbnNpdGlvbkVuZCBoYW5kbGVyXG5mdW5jdGlvbiBvblRyYW5zaXRpb25FbmQoKSB7XG4gIFBqYXgudHJhbnNpdGlvbkluUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgRGlzcGF0Y2hlci50cmlnZ2VyKCd0cmFuc2l0aW9uRW5kJyxcbiAgICBIaXN0b3J5LmN1cnJlbnRTdGF0dXMoKSxcbiAgICBIaXN0b3J5LnByZXZTdGF0dXMoKVxuICApO1xufVxuXG4vLy8gUEpBWFxudmFyIFBqYXggPSBtb2R1bGUuZXhwb3J0cyA9IHtcblxuICAvLy8gd2hldGhlciB0byB1c2UgY2FjaGVcbiAgY2FjaGVFbmFibGVkOiB0cnVlLFxuXG4gIC8vLyB3aGV0aGVyIHRyYW5zaXRpb24gaXMgaW4gcHJvZ3Jlc3NcbiAgdHJhbnNpdGlvbkluUHJvZ3Jlc3M6IGZhbHNlLFxuXG4gIC8vLyB3aGF0IHRyYW5zaXRpb24gdG8gdXNlXG4gIC8vLyAqIGVpdGhlciBjaGFuZ2UgdGhpcy4uLlxuICBkZWZhdWx0VHJhbnNpdGlvbjogcmVxdWlyZSgnLi9QamF4L0hpZGVTaG93VHJhbnNpdGlvbicpLFxuICAvLy8gLi4ub3IgY2hhbmdlIHRoaXMsIHRvIGFmZmVjdCBkZWZhdWx0c1xuICBnZXRUcmFuc2l0aW9uOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuZGVmYXVsdFRyYW5zaXRpb247IH0sXG5cbiAgLy8vIGluaXRpYWxpemVcbiAgaW5pdDogZnVuY3Rpb24oKSB7XG5cbiAgICAvLyBnZXQgdGhlIGNvbnRhaW5lclxuICAgIHZhciBjb250YWluZXIgPSBEb20uZ2V0Q29udGFpbmVyKCk7XG5cbiAgICBIaXN0b3J5LmFkZChcbiAgICAgIGdldEN1cnJlbnRVcmwoKSxcbiAgICAgIERvbS5nZXROYW1lc3BhY2UoY29udGFpbmVyKVxuICAgICk7XG5cbiAgICAvLyBmaXJlIGN1c3RvbSBldmVudHMgZm9yIHRoZSBjdXJyZW50IHZpZXcuXG4gICAgRGlzcGF0Y2hlci50cmlnZ2VyKCdzdGF0ZUNoYW5nZScsIEhpc3RvcnkuY3VycmVudFN0YXR1cygpKTtcbiAgICBEaXNwYXRjaGVyLnRyaWdnZXIoJ25ld1BhZ2VSZWFkeScsIEhpc3RvcnkuY3VycmVudFN0YXR1cygpLCB7fSwgY29udGFpbmVyKTtcbiAgICBEaXNwYXRjaGVyLnRyaWdnZXIoJ3RyYW5zaXRpb25FbmQnLCBIaXN0b3J5LmN1cnJlbnRTdGF0dXMoKSk7XG5cbiAgICAvLyBiaW5kIG5hdGl2ZSBldmVudHNcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIG9uTGlua0NsaWNrKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncG9wc3RhdGUnLCBvblN0YXRlQ2hhbmdlKTtcbiAgfSxcblxuICAvLy8gbG9hZCBhIG5ldyBwYWdlOyByZXR1cm4gUHJvbWlzZVxuICBsb2FkOiBmdW5jdGlvbih1cmwpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBVdGlscy5kZWZlcnJlZCgpO1xuICAgIHZhciB4aHIgPSBDYWNoZS5nZXQodXJsKTtcbiAgICBpZiAoIXhocikge1xuICAgICAgeGhyID0gVXRpbHMueGhyKHVybCk7XG4gICAgICBDYWNoZS5zZXQodXJsLCB4aHIpO1xuICAgIH1cbiAgICB4aHIudGhlbihcbiAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgdmFyIGNvbnRhaW5lciA9IERvbS5wYXJzZVJlc3BvbnNlKGRhdGEpO1xuICAgICAgICBEb20ucHV0Q29udGFpbmVyKGNvbnRhaW5lcik7XG4gICAgICAgIGlmICghUGpheC5jYWNoZUVuYWJsZWQpIENhY2hlLnJlc2V0KCk7XG4gICAgICAgIGRlZmVycmVkLnJlc29sdmUoY29udGFpbmVyKTtcbiAgICAgIH0sXG4gICAgICAvLyBlcnJvclxuICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbiA9IHVybDtcbiAgICAgICAgZGVmZXJyZWQucmVqZWN0KCk7XG4gICAgICB9XG4gICAgKTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgfSxcblxuICAvLy8gZXhwb3N1cmUgb2Ygb3RoZXIgb2JqZWN0c1xuICBDYWNoZTogQ2FjaGUsXG4gIERvbTogRG9tLFxuICBIaXN0b3J5OiBIaXN0b3J5LFxuICBQcmVmZXRjaDogUHJlZmV0Y2gsXG4gIFRyYW5zaXRpb246IFRyYW5zaXRpb24sXG4gIFV0aWxzOiBVdGlscyxcbiAgVmlldzogVmlld1xufTtcbiIsIi8vLyBDQUNIRVxudmFyIENhY2hlID0gbW9kdWxlLmV4cG9ydHMgPSB7XG4gIC8vIGV4dGVuZCBmdW5jdGlvbiAtLSBuZWNlc3Nhcnk/XG4gIGV4dGVuZDogZnVuY3Rpb24ob2JqKSB7IHJldHVybiBVdGlscy5leHRlbmQodGhpcywgb2JqKTsgfSxcbiAgLy8gaG9sZGVyXG4gIGRhdGE6IHt9LFxuICAvLyBzZXRcbiAgc2V0OiBmdW5jdGlvbihrZXksIHZhbCkgeyB0aGlzLmRhdGFba2V5XSA9IHZhbDsgfSxcbiAgLy8gZ2V0XG4gIGdldDogZnVuY3Rpb24oa2V5KSB7IHJldHVybiB0aGlzLmRhdGFba2V5XTsgfSxcbiAgLy8gcmVzZXRcbiAgcmVzZXQ6IGZ1bmN0aW9uKCkgeyB0aGlzLmRhdGEgPSB7fTsgfVxufTtcbiIsIi8vLyBET01cbnZhciBEb20gPSBtb2R1bGUuZXhwb3J0cyA9IHtcblxuICAvLy8gZGF0YSBOQU1FU1BBQ0UgZGVmYXVsdFxuICBkYXRhTmFtZXNwYWNlOiAnbmFtZXNwYWNlJyxcblxuICAvLy8gd3JhcHBlciBJRCBkZWZhdWx0XG4gIC8vLyAqIHRoZXJlIHdpbGwgb25seSBldmVyIGJlIG9uZSBvZiB0aGVzZVxuICB3cmFwcGVySWQ6ICdwamF4LXdyYXBwZXInLFxuXG4gIC8vLyBjb250YWluZXIgQ0xBU1MgZGVmYXVsdFxuICAvLy8gKiB0aGVyZSB3aWxsIGF0IGEgcG9pbnQgYmUgdHdvIG9mIHRoZXNlIGluIHRoZSBET00gKG9sZCBhbmQgbmV3KVxuICBjb250YWluZXJDbGFzczogJ3BqYXgtY29udGFpbmVyJyxcblxuICAvLy8gcGFyc2UgdGhlIHJlc3BvbnNlIGZyb20gWEhSXG4gIC8vLyAxLiBwbGFjZSBjb250ZW50IGluIGRldGFjaGVkIGRpdlxuICAvLy8gMi4gcGFyc2Ugb3V0IDx0aXRsZT4gZWxlbWVudCB0ZXh0IGFuZCBzZXQgaXRcbiAgLy8vIDMuIGV4dHJhY3QgdGhlIG5ld0NvbnRhaW5lciBlbGVtZW50XG4gIHBhcnNlUmVzcG9uc2U6IGZ1bmN0aW9uKHJlc3BvbnNlVGV4dCkge1xuICAgIHZhciB3cmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgd3JhcHBlci5pbm5lckhUTUwgPSByZXNwb25zZVRleHQ7XG4gICAgdmFyIHRpdGxlRWwgPSB3cmFwcGVyLnF1ZXJ5U2VsZWN0b3IoJ3RpdGxlJyk7XG4gICAgaWYgKHRpdGxlRWwpXG4gICAgICBkb2N1bWVudC50aXRsZSA9IHRpdGxlRWwudGV4dENvbnRlbnQ7XG4gICAgcmV0dXJuIHRoaXMuZ2V0Q29udGFpbmVyKHdyYXBwZXIpO1xuICB9LFxuXG4gIC8vLyBnZXQgdGhlIHdyYXBwZXJcbiAgZ2V0V3JhcHBlcjogZnVuY3Rpb24oKSB7IHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCh0aGlzLndyYXBwZXJJZCk7IH0sXG5cbiAgLy8vIGdldCB0aGUgY29udGFpbmVyXG4gIC8vLyAqIGFjY2VwdCBhIGdpdmVuIHdyYXBwZXIsIG9yIHVzZSBkZWZhdWx0IHdyYXBwZXJcbiAgZ2V0Q29udGFpbmVyOiBmdW5jdGlvbih3cmFwcGVyKSB7XG4gICAgaWYgKCF3cmFwcGVyKVxuICAgICAgd3JhcHBlciA9IHRoaXMuZ2V0V3JhcHBlcigpO1xuICAgIGlmICghd3JhcHBlcilcbiAgICAgIHRocm93IG5ldyBFcnJvcignQmFyYmEuanM6IERPTSBub3QgcmVhZHkhJyk7XG4gICAgdmFyIGNvbnRhaW5lciA9IHdyYXBwZXIucXVlcnlTZWxlY3RvcignLicgKyB0aGlzLmNvbnRhaW5lckNsYXNzKTtcbiAgICBpZiAoY29udGFpbmVyICYmIGNvbnRhaW5lci5qcXVlcnkpXG4gICAgICBjb250YWluZXIgPSBjb250YWluZXJbMF07XG4gICAgaWYgKCFjb250YWluZXIpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0JhcmJhLmpzOiBubyBjb250YWluZXIgZm91bmQnKTtcbiAgICByZXR1cm4gY29udGFpbmVyO1xuICB9LFxuXG4gIC8vLyBnZXQgdGhlIG5hbWVzcGFjZSBvZiB0aGUgY29udGFpbmVyXG4gIGdldE5hbWVzcGFjZTogZnVuY3Rpb24oY29udGFpbmVyKSB7XG4gICAgaWYgKGNvbnRhaW5lciAmJiBjb250YWluZXIuZGF0YXNldCkge1xuICAgICAgcmV0dXJuIGNvbnRhaW5lci5kYXRhc2V0W3RoaXMuZGF0YU5hbWVzcGFjZV07XG4gICAgfSBlbHNlIGlmIChjb250YWluZXIpIHtcbiAgICAgIHJldHVybiBjb250YWluZXIuZ2V0QXR0cmlidXRlKCdkYXRhLScgKyB0aGlzLmRhdGFOYW1lc3BhY2UpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvLy8gcHV0IHRoZSBjb250YWluZXIgaW4gdG8gdGhlIHdyYXBwZXIsIHdpdGggdmlzaWJpbGl0eSAnaGlkZGVuJ1xuICBwdXRDb250YWluZXI6IGZ1bmN0aW9uKGNvbnRhaW5lcikge1xuICAgIGNvbnRhaW5lci5zdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgdGhpcy5nZXRXcmFwcGVyKCkuYXBwZW5kQ2hpbGQoY29udGFpbmVyKTtcbiAgfVxufTtcbiIsInZhciBUcmFuc2l0aW9uID0gcmVxdWlyZSgnLi9UcmFuc2l0aW9uJyk7XG5cbnZhciBIaWRlU2hvd1RyYW5zaXRpb24gPSBtb2R1bGUuZXhwb3J0cyA9IFRyYW5zaXRpb24uZXh0ZW5kKHtcbiAgc3RhcnQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMubmV3Q29udGFpbmVyUHJvbWlzZS50aGVuKHRoaXMuaGlkZVNob3cuYmluZCh0aGlzKSk7XG4gIH0sXG5cbiAgaGlkZVNob3c6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMub2xkQ29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICB0aGlzLm5ld0NvbnRhaW5lci5zdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICAgIGRvY3VtZW50LmJvZHkuc2Nyb2xsVG9wID0gMDtcblxuICAgIHRoaXMuZG9uZSgpO1xuICB9XG59KTtcbiIsIi8vLyBISVNUT1JZXG52YXIgSGlzdG9yeSA9IG1vZHVsZS5leHBvcnRzID0ge1xuXG4gIGhpc3Rvcnk6IFtdLFxuXG4gIGFkZDogZnVuY3Rpb24odXJsLCBuYW1lc3BhY2UpIHtcbiAgICBpZiAoIW5hbWVzcGFjZSlcbiAgICAgIG5hbWVzcGFjZSA9IHVuZGVmaW5lZDtcblxuICAgIHRoaXMuaGlzdG9yeS5wdXNoKHtcbiAgICAgIHVybDogdXJsLFxuICAgICAgbmFtZXNwYWNlOiBuYW1lc3BhY2VcbiAgICB9KTtcbiAgfSxcblxuICBjdXJyZW50U3RhdHVzOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5oaXN0b3J5W3RoaXMuaGlzdG9yeS5sZW5ndGggLSAxXTtcbiAgfSxcblxuICBwcmV2U3RhdHVzOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgaGlzdG9yeSA9IHRoaXMuaGlzdG9yeTtcblxuICAgIGlmIChoaXN0b3J5Lmxlbmd0aCA8IDIpXG4gICAgICByZXR1cm4gbnVsbDtcblxuICAgIHJldHVybiBoaXN0b3J5W2hpc3RvcnkubGVuZ3RoIC0gMl07XG4gIH1cbn07XG5cbiIsInZhciBVdGlscyA9IHJlcXVpcmUoJy4vVXRpbHMnKTtcbnZhciBDYWNoZSA9IHJlcXVpcmUoJy4vQ2FjaGUnKTtcblxuZnVuY3Rpb24gb25MaW5rRW50ZXIoZXZlbnQpIHtcbiAgLy8gZ2V0IGV2ZW50IHRhcmdldFxuICB2YXIgZWwgPSBldmVudC50YXJnZXQ7XG4gIC8vIHRyYXZlcnNlIHVwIHVudGlsIHZhbGlkIGhyZWZcbiAgd2hpbGUgKGVsICYmICFlbC5ocmVmKSB7IGVsID0gZWwucGFyZW50Tm9kZTsgfVxuICAvLyBpZiBub3RoaW5nIGZvdW5kLCBiYWlsXG4gIGlmICghZWwpIHsgcmV0dXJuOyB9XG4gIC8vIGdldCB0aGUgVVJMXG4gIHZhciB1cmwgPSBlbC5ocmVmO1xuICAvLyBpZiBsaW5rIGlzIHZhbGlkLi4uXG4gIGlmIChVdGlscy52YWxpZExpbmsoZWwsIGV2ZW50KSAmJiAhQ2FjaGUuZ2V0KHVybCkpIHtcbiAgICAvLyBnZXQgdGhlIGNvbnRlbnRcbiAgICB2YXIgeGhyID0gVXRpbHMueGhyKHVybCk7XG4gICAgLy8gYnVuZyBpdCBpbiB0aGUgY2FjaGVcbiAgICBDYWNoZS5zZXQodXJsLCB4aHIpO1xuICB9XG59XG5cbi8vLyBQUkVGRVRDSFxudmFyIFByZWZldGNoID0gbW9kdWxlLmV4cG9ydHMgPSB7XG4gIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgIGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VvdmVyJywgb25MaW5rRW50ZXIpO1xuICAgIGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIG9uTGlua0VudGVyKTtcbiAgfVxufTtcbiIsInZhciBVdGlscyA9IHJlcXVpcmUoJy4vVXRpbHMnKTtcblxuLy8vIFRSQU5TSVRJT05cbnZhciBUcmFuc2l0aW9uID0gbW9kdWxlLmV4cG9ydHMgPSB7XG4gIGV4dGVuZDogZnVuY3Rpb24ob2JqKXsgcmV0dXJuIFV0aWxzLmV4dGVuZCh0aGlzLCBvYmopOyB9LFxuXG4gIG9sZENvbnRhaW5lcjogdW5kZWZpbmVkLFxuICBuZXdDb250YWluZXI6IHVuZGVmaW5lZCxcbiAgY29udGFpbmVyTG9hZGVkOiB1bmRlZmluZWQsXG4gIGNvbXBsZXRlZDogdW5kZWZpbmVkLFxuICAvLy8gUkVOREVSXG4gIC8vLyAqIHdoYXQgc2hvdWxkIGhhcHBlbiBkdXJpbmcgdHJhbnNpdGlvblxuICAvLy8gKiBtdXN0IGNhbGwgcmVzb2x2ZSgpIGZ1bmN0aW9uIGF0IGVuZFxuICByZW5kZXI6IGZ1bmN0aW9uKCkge30sXG5cbiAgLy8vIFJFU09MVkVcbiAgcmVzb2x2ZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5vbGRDb250YWluZXIucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLm9sZENvbnRhaW5lcik7XG4gICAgdGhpcy5jb21wbGV0ZWQucmVzb2x2ZSgpO1xuICB9LFxuXG4gIC8vLyBJTklUXG4gIC8vLyBvbGRDb250YWluZXIgPSBOb2RlXG4gIC8vLyBuZXdDb250YWluZXIgPSBQcm9taXNlXG4gIGluaXQ6IGZ1bmN0aW9uKG9sZENvbnRhaW5lciwgcHJvbWlzZWRDb250YWluZXIpIHtcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgIHZhciBMb2FkID0gVXRpbHMuZGVmZXJyZWQoKTtcblxuICAgIHRoaXMuY29tcGxldGVkID0gVXRpbHMuZGVmZXJyZWQoKTtcbiAgICB0aGlzLm9sZENvbnRhaW5lciA9IG9sZENvbnRhaW5lcjtcbiAgICB0aGlzLmNvbnRhaW5lckxvYWRlZCA9IExvYWQucHJvbWlzZTtcblxuICAgIHRoaXMucmVuZGVyKCk7XG5cbiAgICBwcm9taXNlZENvbnRhaW5lci50aGVuKGZ1bmN0aW9uKG5ld0NvbnRhaW5lcikge1xuICAgICAgX3RoaXMubmV3Q29udGFpbmVyID0gbmV3Q29udGFpbmVyO1xuICAgICAgTG9hZC5yZXNvbHZlKCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcy5jb21wbGV0ZWQucHJvbWlzZTtcbiAgfSxcblxufTtcbiIsIi8qKlxuICogSnVzdCBhbiBvYmplY3Qgd2l0aCBzb21lIGhlbHBmdWwgZnVuY3Rpb25zXG4gKlxuICogQHR5cGUge09iamVjdH1cbiAqIEBuYW1lc3BhY2UgQmFyYmEuVXRpbHNcbiAqL1xudmFyIFV0aWxzID0ge1xuICAvKipcbiAgICogUmV0dXJuIHRoZSBjdXJyZW50IHVybFxuICAgKlxuICAgKiBAbWVtYmVyT2YgQmFyYmEuVXRpbHNcbiAgICogQHJldHVybiB7U3RyaW5nfSBjdXJyZW50VXJsXG4gICAqL1xuICBnZXRDdXJyZW50VXJsOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gd2luZG93LmxvY2F0aW9uLnByb3RvY29sICsgJy8vJyArXG4gICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5ob3N0ICtcbiAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lICtcbiAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLnNlYXJjaDtcbiAgfSxcblxuICAvKipcbiAgICogR2l2ZW4gYW4gdXJsLCByZXR1cm4gaXQgd2l0aG91dCB0aGUgaGFzaFxuICAgKlxuICAgKiBAbWVtYmVyT2YgQmFyYmEuVXRpbHNcbiAgICogQHBhcmFtICB7U3RyaW5nfSB1cmxcbiAgICogQHJldHVybiB7U3RyaW5nfSBuZXdDbGVhblVybFxuICAgKi9cbiAgY2xlYW5MaW5rOiBmdW5jdGlvbih1cmwpIHtcbiAgICByZXR1cm4gdXJsLnJlcGxhY2UoLyMuKi8sICcnKTtcbiAgfSxcblxuICAvLy8gd2hldGhlciBhIGxpbmsgc2hvdWxkIGJlIGZvbGxvd2VkXG4gIHZhbGlkTGluazogZnVuY3Rpb24oZWxlbWVudCwgZXZlbnQpIHtcbiAgICBpZiAoIWhpc3RvcnkucHVzaFN0YXRlKSByZXR1cm4gZmFsc2U7XG4gICAgLy8vIHVzZXJcbiAgICBpZiAoIWVsZW1lbnQgfHwgIWVsZW1lbnQuaHJlZikgcmV0dXJuIGZhbHNlO1xuICAgIC8vLyBtaWRkbGUgY2xpY2ssIGNtZCBjbGljaywgYW5kIGN0cmwgY2xpY2tcbiAgICBpZiAoZXZlbnQud2hpY2ggPiAxIHx8IGV2ZW50Lm1ldGFLZXkgfHwgZXZlbnQuY3RybEtleSB8fCBldmVudC5zaGlmdEtleSB8fCBldmVudC5hbHRLZXkpIHJldHVybiBmYWxzZTtcbiAgICAvLy8gaWdub3JlIHRhcmdldCB3aXRoIF9ibGFuayB0YXJnZXRcbiAgICBpZiAoZWxlbWVudC50YXJnZXQgJiYgZWxlbWVudC50YXJnZXQgPT09ICdfYmxhbmsnKSByZXR1cm4gZmFsc2U7XG4gICAgLy8vIGNoZWNrIGlmIGl0J3MgdGhlIHNhbWUgZG9tYWluXG4gICAgaWYgKHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCAhPT0gZWxlbWVudC5wcm90b2NvbCB8fCB3aW5kb3cubG9jYXRpb24uaG9zdG5hbWUgIT09IGVsZW1lbnQuaG9zdG5hbWUpIHJldHVybiBmYWxzZTtcbiAgICAvLy8gY2hlY2sgaWYgdGhlIHBvcnQgaXMgdGhlIHNhbWVcbiAgICBpZiAoVXRpbHMuZ2V0UG9ydCgpICE9PSBVdGlscy5nZXRQb3J0KGVsZW1lbnQucG9ydCkpIHJldHVybiBmYWxzZTtcbiAgICAvLy8gaWdub3JlIGNhc2Ugd2hlbiBhIGhhc2ggaXMgYmVpbmcgdGFja2VkIG9uIHRoZSBjdXJyZW50IHVybFxuICAgIGlmIChlbGVtZW50LmhyZWYuaW5kZXhPZignIycpID4gLTEpIHJldHVybiBmYWxzZTtcbiAgICAvLy8gaW4gY2FzZSB5b3UncmUgdHJ5aW5nIHRvIGxvYWQgdGhlIHNhbWUgcGFnZVxuICAgIGlmIChVdGlscy5jbGVhbkxpbmsoZWxlbWVudC5ocmVmKSA9PSBVdGlscy5jbGVhbkxpbmsobG9jYXRpb24uaHJlZikpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ25vLWJhcmJhJykpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcblxuICAvKipcbiAgICogVGltZSBpbiBtaWxsaXNlY29uZCBhZnRlciB0aGUgeGhyIHJlcXVlc3QgZ29lcyBpbiB0aW1lb3V0XG4gICAqXG4gICAqIEBtZW1iZXJPZiBCYXJiYS5VdGlsc1xuICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgKiBAZGVmYXVsdFxuICAgKi9cbiAgeGhyVGltZW91dDogNTAwMCxcblxuICAvKipcbiAgICogU3RhcnQgYW4gWE1MSHR0cFJlcXVlc3QoKSBhbmQgcmV0dXJuIGEgUHJvbWlzZVxuICAgKlxuICAgKiBAbWVtYmVyT2YgQmFyYmEuVXRpbHNcbiAgICogQHBhcmFtICB7U3RyaW5nfSB1cmxcbiAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICovXG4gIHhocjogZnVuY3Rpb24odXJsKSB7XG4gICAgdmFyIGRlZmVycmVkID0gdGhpcy5kZWZlcnJlZCgpO1xuICAgIHZhciByZXEgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgIHJlcS5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChyZXEucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICBpZiAocmVxLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgcmV0dXJuIGRlZmVycmVkLnJlc29sdmUocmVxLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGRlZmVycmVkLnJlamVjdChuZXcgRXJyb3IoJ3hocjogSFRUUCBjb2RlIGlzIG5vdCAyMDAnKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmVxLm9udGltZW91dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGRlZmVycmVkLnJlamVjdChuZXcgRXJyb3IoJ3hocjogVGltZW91dCBleGNlZWRlZCcpKTtcbiAgICB9O1xuXG4gICAgcmVxLm9wZW4oJ0dFVCcsIHVybCk7XG4gICAgcmVxLnRpbWVvdXQgPSB0aGlzLnhoclRpbWVvdXQ7XG4gICAgcmVxLnNldFJlcXVlc3RIZWFkZXIoJ3gtYmFyYmEnLCAneWVzJyk7XG4gICAgcmVxLnNlbmQoKTtcblxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXQgb2JqIGFuZCBwcm9wcyBhbmQgcmV0dXJuIGEgbmV3IG9iamVjdCB3aXRoIHRoZSBwcm9wZXJ0eSBtZXJnZWRcbiAgICpcbiAgICogQG1lbWJlck9mIEJhcmJhLlV0aWxzXG4gICAqIEBwYXJhbSAge29iamVjdH0gb2JqXG4gICAqIEBwYXJhbSAge29iamVjdH0gcHJvcHNcbiAgICogQHJldHVybiB7b2JqZWN0fVxuICAgKi9cbiAgZXh0ZW5kOiBmdW5jdGlvbihvYmosIHByb3BzKSB7XG4gICAgdmFyIG5ld09iaiA9IE9iamVjdC5jcmVhdGUob2JqKTtcblxuICAgIGZvcih2YXIgcHJvcCBpbiBwcm9wcykge1xuICAgICAgaWYocHJvcHMuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgbmV3T2JqW3Byb3BdID0gcHJvcHNbcHJvcF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld09iajtcbiAgfSxcblxuICAvKipcbiAgICogUmV0dXJuIGEgbmV3IFwiRGVmZXJyZWRcIiBvYmplY3RcbiAgICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9Nb3ppbGxhL0phdmFTY3JpcHRfY29kZV9tb2R1bGVzL1Byb21pc2UuanNtL0RlZmVycmVkXG4gICAqXG4gICAqIEByZXR1cm4ge0RlZmVycmVkfVxuICAgKi9cbiAgZGVmZXJyZWQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnJlc29sdmUgPSBudWxsO1xuICAgICAgdGhpcy5yZWplY3QgPSBudWxsO1xuXG4gICAgICB0aGlzLnByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgdGhpcy5yZXNvbHZlID0gcmVzb2x2ZTtcbiAgICAgICAgdGhpcy5yZWplY3QgPSByZWplY3Q7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH07XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgcG9ydCBudW1iZXIgbm9ybWFsaXplZCwgZXZlbnR1YWxseSB5b3UgY2FuIHBhc3MgYSBzdHJpbmcgdG8gYmUgbm9ybWFsaXplZC5cbiAgICpcbiAgICogQHBhcmFtICB7U3RyaW5nfSBwXG4gICAqIEByZXR1cm4ge0ludH0gcG9ydFxuICAgKi9cbiAgZ2V0UG9ydDogZnVuY3Rpb24ocCkge1xuICAgIHZhciBwb3J0ID0gdHlwZW9mIHAgIT09ICd1bmRlZmluZWQnID8gcCA6IHdpbmRvdy5sb2NhdGlvbi5wb3J0O1xuICAgIHZhciBwcm90b2NvbCA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbDtcblxuICAgIGlmIChwb3J0ICE9ICcnKVxuICAgICAgcmV0dXJuIHBhcnNlSW50KHBvcnQpO1xuXG4gICAgaWYgKHByb3RvY29sID09PSAnaHR0cDonKVxuICAgICAgcmV0dXJuIDgwO1xuXG4gICAgaWYgKHByb3RvY29sID09PSAnaHR0cHM6JylcbiAgICAgIHJldHVybiA0NDM7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVXRpbHM7XG4iLCJ2YXIgRGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4uL0Rpc3BhdGNoZXInKTtcbnZhciBVdGlscyAgICAgID0gcmVxdWlyZSgnLi9VdGlscycpO1xuXG4vLy8gVklFV1xudmFyIFZpZXcgPSBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgZXh0ZW5kOiBmdW5jdGlvbihvYmopeyByZXR1cm4gVXRpbHMuZXh0ZW5kKHRoaXMsIG9iaik7IH0sXG5cbiAgbmFtZXNwYWNlOiBudWxsLFxuXG4gIG5ld1N0YXJ0OiBmdW5jdGlvbigpIHt9LFxuICBuZXdDb21wbGV0ZTogZnVuY3Rpb24oKSB7fSxcbiAgb2xkU3RhcnQ6IGZ1bmN0aW9uKCkge30sXG4gIG9sZENvbXBsZXRlOiBmdW5jdGlvbigpIHt9LFxuXG4gIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICBEaXNwYXRjaGVyLm9uKCdzdGF0ZUNoYW5nZScsXG4gICAgICBmdW5jdGlvbihuZXdTdGF0dXMsIG9sZFN0YXR1cykge1xuICAgICAgICBpZiAob2xkU3RhdHVzICYmIG9sZFN0YXR1cy5uYW1lc3BhY2UgPT09IF90aGlzLm5hbWVzcGFjZSlcbiAgICAgICAgICAvLyBvbGRDb250YWluZXIgcmVhZHkgdG8gdHJhbnMgT1VUXG4gICAgICAgICAgX3RoaXMub2xkU3RhcnQoKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgRGlzcGF0Y2hlci5vbignbmV3UGFnZVJlYWR5JyxcbiAgICAgIGZ1bmN0aW9uKG5ld1N0YXR1cywgb2xkU3RhdHVzLCBjb250YWluZXIpIHtcbiAgICAgICAgX3RoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuXG4gICAgICAgIGlmIChuZXdTdGF0dXMubmFtZXNwYWNlID09PSBfdGhpcy5uYW1lc3BhY2UpXG4gICAgICAgICAgLy8gbmV3Q29udGFpbmVyIGlzIHJlYWR5IHRvIHRyYW5zIElOXG4gICAgICAgICAgX3RoaXMubmV3U3RhcnQoKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgRGlzcGF0Y2hlci5vbigndHJhbnNpdGlvbkVuZCcsXG4gICAgICBmdW5jdGlvbihuZXdTdGF0dXMsIG9sZFN0YXR1cykge1xuICAgICAgICBpZiAobmV3U3RhdHVzLm5hbWVzcGFjZSA9PT0gX3RoaXMubmFtZXNwYWNlKVxuICAgICAgICAgIC8vIG5ld0NvbnRhaW5lciB0cmFucyBJTiBpcyBjb21wbGV0ZVxuICAgICAgICAgIF90aGlzLm5ld0NvbXBsZXRlKCk7XG5cbiAgICAgICAgaWYgKG9sZFN0YXR1cyAmJiBvbGRTdGF0dXMubmFtZXNwYWNlID09PSBfdGhpcy5uYW1lc3BhY2UpXG4gICAgICAgICAgLy8gb2xkQ29udGFpbmVyIHRyYW5zIE9VVCBpcyBjb21wbGV0ZVxuICAgICAgICAgIF90aGlzLm9sZENvbXBsZXRlKCk7XG4gICAgICB9XG4gICAgKTtcbiAgfVxufVxuIiwiZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uKCkge1xuXG4gIHZhciBsYXN0RWxlbWVudENsaWNrZWQ7XG4gIHZhciBQcmV2TGluayA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2EucHJldicpO1xuICB2YXIgTmV4dExpbmsgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdhLm5leHQnKTtcblxuICB2YXIgUGpheCA9IHJlcXVpcmUoJy4uLy4uL3NyYy9QamF4Jyk7XG4gIHZhciBEaXNwYXRjaGVyID0gcmVxdWlyZSgnLi4vLi4vc3JjL0Rpc3BhdGNoZXInKTtcblxuICBQamF4LmluaXQoKTtcbiAgUGpheC5QcmVmZXRjaC5pbml0KCk7XG5cbiAgRGlzcGF0Y2hlci5vbignbGlua0NsaWNrZWQnLCBmdW5jdGlvbihlbCkge1xuICAgIGxhc3RFbGVtZW50Q2xpY2tlZCA9IGVsO1xuICB9KTtcblxuICAvLyBjb25zb2xlLmxvZyhQamF4KTtcblxuICB2YXIgTW92ZVBhZ2UgPSBQamF4LlRyYW5zaXRpb24uZXh0ZW5kKHtcbiAgICByZW5kZXIoKSB7XG4gICAgICB0aGlzLm9yaWdpbmFsVGh1bWIgPSBsYXN0RWxlbWVudENsaWNrZWQ7XG5cbiAgICAgIFByb21pc2VcbiAgICAgICAgLmFsbChbdGhpcy5jb250YWluZXJMb2FkZWQsIHNjcm9sbFRvcCgpXSlcbiAgICAgICAgLnRoZW4obW92ZVBhZ2VzLmJpbmQodGhpcykpO1xuICAgIH1cbiAgfSk7XG5cbiAgUGpheC5kZWZhdWx0VHJhbnNpdGlvbiA9IE1vdmVQYWdlO1xuXG4gIGZ1bmN0aW9uIHNjcm9sbFRvcCgpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBQamF4LlV0aWxzLmRlZmVycmVkKCk7XG4gICAgdmFyIG9iaiA9IHsgeTogd2luZG93LnBhZ2VZT2Zmc2V0IH07XG5cbiAgICBUd2VlbkxpdGUudG8ob2JqLCAwLjQsIHtcbiAgICAgIHk6IDAsXG4gICAgICBvblVwZGF0ZSgpIHtcbiAgICAgICAgaWYgKG9iai55ID09PSAwKSB7XG4gICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgd2luZG93LnNjcm9sbCgwLCBvYmoueSk7XG4gICAgICB9LFxuICAgICAgb25Db21wbGV0ZSgpIHtcbiAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gIH1cblxuICBmdW5jdGlvbiBtb3ZlUGFnZXMoKSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcbiAgICB2YXIgZ29pbmdGb3J3YXJkID0gdHJ1ZTtcbiAgICBQcmV2TGluay5ocmVmID0gdGhpcy5uZXdDb250YWluZXIuZGF0YXNldC5wcmV2O1xuICAgIE5leHRMaW5rLmhyZWYgPSB0aGlzLm5ld0NvbnRhaW5lci5kYXRhc2V0Lm5leHQ7XG5cbiAgICBpZiAoZ2V0TmV3UGFnZUZpbGUoKSA9PT0gdGhpcy5vbGRDb250YWluZXIuZGF0YXNldC5wcmV2KSB7XG4gICAgICBnb2luZ0ZvcndhcmQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBUd2VlbkxpdGUuc2V0KHRoaXMubmV3Q29udGFpbmVyLCB7XG4gICAgICB2aXNpYmlsaXR5OiAndmlzaWJsZScsXG4gICAgICB4UGVyY2VudDogZ29pbmdGb3J3YXJkID8gMTAwIDogLTEwMCxcbiAgICAgIHBvc2l0aW9uOiAnZml4ZWQnLFxuICAgICAgbGVmdDogMCxcbiAgICAgIHRvcDogMCxcbiAgICAgIHJpZ2h0OiAwXG4gICAgfSk7XG5cbiAgICBUd2VlbkxpdGUudG8odGhpcy5vbGRDb250YWluZXIsIDAuNiwge3hQZXJjZW50OiBnb2luZ0ZvcndhcmQgPyAtMTAwIDogMTAwfSk7XG4gICAgVHdlZW5MaXRlLnRvKHRoaXMubmV3Q29udGFpbmVyLCAwLjYsIHt4UGVyY2VudDogMCwgb25Db21wbGV0ZSgpIHtcbiAgICAgIFR3ZWVuTGl0ZS5zZXQoX3RoaXMubmV3Q29udGFpbmVyLCB7Y2xlYXJQcm9wczogJ2FsbCcgfSk7XG4gICAgICBfdGhpcy5yZXNvbHZlKCk7XG4gICAgfX0pO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlTGlua3MoKSB7XG4gICAgUHJldkxpbmsuaHJlZiA9IHRoaXMubmV3Q29udGFpbmVyLmRhdGFzZXQucHJldjtcbiAgICBOZXh0TGluay5ocmVmID0gdGhpcy5uZXdDb250YWluZXIuZGF0YXNldC5uZXh0O1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0TmV3UGFnZUZpbGUgKCkge1xuICAgIHJldHVybiBQamF4Lkhpc3RvcnkuY3VycmVudFN0YXR1cygpLnVybC5zcGxpdCgnLycpLnBvcCgpO1xuICB9XG5cbn0pO1xuIl19
