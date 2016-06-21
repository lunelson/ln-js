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

},{"./Transition":3}],3:[function(require,module,exports){
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

},{"./Utils":4}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
'use strict';

/// Promise polyfill https://github.com/taylorhakes/promise-polyfill
/// alternative -- https://github.com/getify/native-promise-only
if (typeof Promise !== 'function') {
  window.Promise = require('native-promise-only');
}

// general
var Dispatcher = require('./dispatcher');

// pjax specific stuff
var Cache = require('./pjax/cache');
var Dom = require('./pjax/dom');
var History = require('./pjax/history');
var Prefetch = require('./pjax/prefetch');
var Transition = require('./pjax/transition');
var View = require('./pjax/view');
var Utils = require('./pjax/utils');

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
function onStateChange() {

  console.log(History.currStatus());

  // get new URL
  var newUrl = getCurrentUrl();
  // bail out, if current URL is same as new URL
  if (History.currStatus().url === newUrl) return false;
  // check if transition in progress
  if (Pjax.transitionInProgress) {
    /// if trans in prog, force go to new URL
    /// NB. this is where we'd have to cancel the current transition and start another one
    forceGoTo(newUrl);
  }
  // otherwise...
  // fire internal events
  Dispatcher.trigger('stateChange', History.currStatus(), History.prevStatus());
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
  var currStatus = History.currStatus();
  currStatus.namespace = Dom.getNamespace(container);
  Dispatcher.trigger('containerLoad', History.currStatus(), History.prevStatus(), container);
}

/// transitionEnd handler
function onTransitionEnd() {
  Pjax.transitionInProgress = false;
  Dispatcher.trigger('transitionEnd', History.currStatus(), History.prevStatus());
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
    Dispatcher.trigger('stateChange', History.currStatus());
    Dispatcher.trigger('containerLoad', History.currStatus(), {}, container);
    Dispatcher.trigger('transitionEnd', History.currStatus());

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

},{"./Pjax/HideShowTransition":2,"./dispatcher":5,"./pjax/cache":7,"./pjax/dom":8,"./pjax/history":9,"./pjax/prefetch":10,"./pjax/transition":11,"./pjax/utils":12,"./pjax/view":13,"native-promise-only":1}],7:[function(require,module,exports){
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

},{}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
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

  last: function last() {
    return this.history[this.history.length - 1];
  },

  currStatus: function currStatus() {
    return this.history[this.history.length - 1];
  },

  prevStatus: function prevStatus() {
    var history = this.history;

    if (history.length < 2) return null;

    return history[history.length - 2];
  }
};

},{}],10:[function(require,module,exports){
'use strict';

var Utils = require('./utils');
var Cache = require('./cache');

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

},{"./cache":7,"./utils":12}],11:[function(require,module,exports){
'use strict';

var Utils = require('./utils');

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

},{"./utils":12}],12:[function(require,module,exports){
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

},{}],13:[function(require,module,exports){
'use strict';

var Dispatcher = require('../dispatcher');
var Utils = require('./utils');

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

    Dispatcher.on('containerLoad', function (newStatus, oldStatus, container) {
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

},{"../dispatcher":5,"./utils":12}],14:[function(require,module,exports){
'use strict';

document.addEventListener('DOMContentLoaded', function () {

  var lastElementClicked;
  var PrevLink = document.querySelector('a.prev');
  var NextLink = document.querySelector('a.next');

  var Pjax = require('../../src/pjax');
  var Dispatcher = require('../../src/dispatcher');

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
    return Pjax.History.currStatus().url.split('/').pop();
  }
});

},{"../../src/dispatcher":5,"../../src/pjax":6}]},{},[14])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92NS4xMS4xL2xpYi9ub2RlX21vZHVsZXMvZ2xvYmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL25hdGl2ZS1wcm9taXNlLW9ubHkvbGliL25wby5zcmMuanMiLCJzcmMvUGpheC9IaWRlU2hvd1RyYW5zaXRpb24uanMiLCJzcmMvUGpheC9UcmFuc2l0aW9uLmpzIiwic3JjL1BqYXgvVXRpbHMuanMiLCJzcmMvZGlzcGF0Y2hlci5qcyIsInNyYy9wamF4LmpzIiwic3JjL3BqYXgvY2FjaGUuanMiLCJzcmMvcGpheC9kb20uanMiLCJzcmMvcGpheC9oaXN0b3J5LmpzIiwic3JjL3BqYXgvcHJlZmV0Y2guanMiLCJzcmMvcGpheC90cmFuc2l0aW9uLmpzIiwic3JjL3BqYXgvdXRpbHMuanMiLCJzcmMvcGpheC92aWV3LmpzIiwidGVzdC9uZXh0cHJldi9tYWluLmVzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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S0FBSyxZQUFMLENBQWtCLE9BQWxCLENBQTBCLElBQTFDO0FBQ0Q7O0FBRUQsV0FBUyxjQUFULEdBQTJCO0FBQ3pCLFdBQU8sS0FBSyxPQUFMLENBQWEsVUFBYixHQUEwQixHQUExQixDQUE4QixLQUE5QixDQUFvQyxHQUFwQyxFQUF5QyxHQUF6QyxFQUFQO0FBQ0Q7QUFFRixDQXRGRCIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKiEgTmF0aXZlIFByb21pc2UgT25seVxuICAgIHYwLjguMSAoYykgS3lsZSBTaW1wc29uXG4gICAgTUlUIExpY2Vuc2U6IGh0dHA6Ly9nZXRpZnkubWl0LWxpY2Vuc2Uub3JnXG4qL1xuXG4oZnVuY3Rpb24gVU1EKG5hbWUsY29udGV4dCxkZWZpbml0aW9uKXtcblx0Ly8gc3BlY2lhbCBmb3JtIG9mIFVNRCBmb3IgcG9seWZpbGxpbmcgYWNyb3NzIGV2aXJvbm1lbnRzXG5cdGNvbnRleHRbbmFtZV0gPSBjb250ZXh0W25hbWVdIHx8IGRlZmluaXRpb24oKTtcblx0aWYgKHR5cGVvZiBtb2R1bGUgIT0gXCJ1bmRlZmluZWRcIiAmJiBtb2R1bGUuZXhwb3J0cykgeyBtb2R1bGUuZXhwb3J0cyA9IGNvbnRleHRbbmFtZV07IH1cblx0ZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lLmFtZCkgeyBkZWZpbmUoZnVuY3Rpb24gJEFNRCQoKXsgcmV0dXJuIGNvbnRleHRbbmFtZV07IH0pOyB9XG59KShcIlByb21pc2VcIix0eXBlb2YgZ2xvYmFsICE9IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0aGlzLGZ1bmN0aW9uIERFRigpe1xuXHQvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuXHRcInVzZSBzdHJpY3RcIjtcblxuXHR2YXIgYnVpbHRJblByb3AsIGN5Y2xlLCBzY2hlZHVsaW5nX3F1ZXVlLFxuXHRcdFRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZyxcblx0XHR0aW1lciA9ICh0eXBlb2Ygc2V0SW1tZWRpYXRlICE9IFwidW5kZWZpbmVkXCIpID9cblx0XHRcdGZ1bmN0aW9uIHRpbWVyKGZuKSB7IHJldHVybiBzZXRJbW1lZGlhdGUoZm4pOyB9IDpcblx0XHRcdHNldFRpbWVvdXRcblx0O1xuXG5cdC8vIGRhbW1pdCwgSUU4LlxuXHR0cnkge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh7fSxcInhcIix7fSk7XG5cdFx0YnVpbHRJblByb3AgPSBmdW5jdGlvbiBidWlsdEluUHJvcChvYmosbmFtZSx2YWwsY29uZmlnKSB7XG5cdFx0XHRyZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaixuYW1lLHtcblx0XHRcdFx0dmFsdWU6IHZhbCxcblx0XHRcdFx0d3JpdGFibGU6IHRydWUsXG5cdFx0XHRcdGNvbmZpZ3VyYWJsZTogY29uZmlnICE9PSBmYWxzZVxuXHRcdFx0fSk7XG5cdFx0fTtcblx0fVxuXHRjYXRjaCAoZXJyKSB7XG5cdFx0YnVpbHRJblByb3AgPSBmdW5jdGlvbiBidWlsdEluUHJvcChvYmosbmFtZSx2YWwpIHtcblx0XHRcdG9ialtuYW1lXSA9IHZhbDtcblx0XHRcdHJldHVybiBvYmo7XG5cdFx0fTtcblx0fVxuXG5cdC8vIE5vdGU6IHVzaW5nIGEgcXVldWUgaW5zdGVhZCBvZiBhcnJheSBmb3IgZWZmaWNpZW5jeVxuXHRzY2hlZHVsaW5nX3F1ZXVlID0gKGZ1bmN0aW9uIFF1ZXVlKCkge1xuXHRcdHZhciBmaXJzdCwgbGFzdCwgaXRlbTtcblxuXHRcdGZ1bmN0aW9uIEl0ZW0oZm4sc2VsZikge1xuXHRcdFx0dGhpcy5mbiA9IGZuO1xuXHRcdFx0dGhpcy5zZWxmID0gc2VsZjtcblx0XHRcdHRoaXMubmV4dCA9IHZvaWQgMDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0YWRkOiBmdW5jdGlvbiBhZGQoZm4sc2VsZikge1xuXHRcdFx0XHRpdGVtID0gbmV3IEl0ZW0oZm4sc2VsZik7XG5cdFx0XHRcdGlmIChsYXN0KSB7XG5cdFx0XHRcdFx0bGFzdC5uZXh0ID0gaXRlbTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRmaXJzdCA9IGl0ZW07XG5cdFx0XHRcdH1cblx0XHRcdFx0bGFzdCA9IGl0ZW07XG5cdFx0XHRcdGl0ZW0gPSB2b2lkIDA7XG5cdFx0XHR9LFxuXHRcdFx0ZHJhaW46IGZ1bmN0aW9uIGRyYWluKCkge1xuXHRcdFx0XHR2YXIgZiA9IGZpcnN0O1xuXHRcdFx0XHRmaXJzdCA9IGxhc3QgPSBjeWNsZSA9IHZvaWQgMDtcblxuXHRcdFx0XHR3aGlsZSAoZikge1xuXHRcdFx0XHRcdGYuZm4uY2FsbChmLnNlbGYpO1xuXHRcdFx0XHRcdGYgPSBmLm5leHQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9KSgpO1xuXG5cdGZ1bmN0aW9uIHNjaGVkdWxlKGZuLHNlbGYpIHtcblx0XHRzY2hlZHVsaW5nX3F1ZXVlLmFkZChmbixzZWxmKTtcblx0XHRpZiAoIWN5Y2xlKSB7XG5cdFx0XHRjeWNsZSA9IHRpbWVyKHNjaGVkdWxpbmdfcXVldWUuZHJhaW4pO1xuXHRcdH1cblx0fVxuXG5cdC8vIHByb21pc2UgZHVjayB0eXBpbmdcblx0ZnVuY3Rpb24gaXNUaGVuYWJsZShvKSB7XG5cdFx0dmFyIF90aGVuLCBvX3R5cGUgPSB0eXBlb2YgbztcblxuXHRcdGlmIChvICE9IG51bGwgJiZcblx0XHRcdChcblx0XHRcdFx0b190eXBlID09IFwib2JqZWN0XCIgfHwgb190eXBlID09IFwiZnVuY3Rpb25cIlxuXHRcdFx0KVxuXHRcdCkge1xuXHRcdFx0X3RoZW4gPSBvLnRoZW47XG5cdFx0fVxuXHRcdHJldHVybiB0eXBlb2YgX3RoZW4gPT0gXCJmdW5jdGlvblwiID8gX3RoZW4gOiBmYWxzZTtcblx0fVxuXG5cdGZ1bmN0aW9uIG5vdGlmeSgpIHtcblx0XHRmb3IgKHZhciBpPTA7IGk8dGhpcy5jaGFpbi5sZW5ndGg7IGkrKykge1xuXHRcdFx0bm90aWZ5SXNvbGF0ZWQoXG5cdFx0XHRcdHRoaXMsXG5cdFx0XHRcdCh0aGlzLnN0YXRlID09PSAxKSA/IHRoaXMuY2hhaW5baV0uc3VjY2VzcyA6IHRoaXMuY2hhaW5baV0uZmFpbHVyZSxcblx0XHRcdFx0dGhpcy5jaGFpbltpXVxuXHRcdFx0KTtcblx0XHR9XG5cdFx0dGhpcy5jaGFpbi5sZW5ndGggPSAwO1xuXHR9XG5cblx0Ly8gTk9URTogVGhpcyBpcyBhIHNlcGFyYXRlIGZ1bmN0aW9uIHRvIGlzb2xhdGVcblx0Ly8gdGhlIGB0cnkuLmNhdGNoYCBzbyB0aGF0IG90aGVyIGNvZGUgY2FuIGJlXG5cdC8vIG9wdGltaXplZCBiZXR0ZXJcblx0ZnVuY3Rpb24gbm90aWZ5SXNvbGF0ZWQoc2VsZixjYixjaGFpbikge1xuXHRcdHZhciByZXQsIF90aGVuO1xuXHRcdHRyeSB7XG5cdFx0XHRpZiAoY2IgPT09IGZhbHNlKSB7XG5cdFx0XHRcdGNoYWluLnJlamVjdChzZWxmLm1zZyk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0aWYgKGNiID09PSB0cnVlKSB7XG5cdFx0XHRcdFx0cmV0ID0gc2VsZi5tc2c7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0cmV0ID0gY2IuY2FsbCh2b2lkIDAsc2VsZi5tc2cpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHJldCA9PT0gY2hhaW4ucHJvbWlzZSkge1xuXHRcdFx0XHRcdGNoYWluLnJlamVjdChUeXBlRXJyb3IoXCJQcm9taXNlLWNoYWluIGN5Y2xlXCIpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmIChfdGhlbiA9IGlzVGhlbmFibGUocmV0KSkge1xuXHRcdFx0XHRcdF90aGVuLmNhbGwocmV0LGNoYWluLnJlc29sdmUsY2hhaW4ucmVqZWN0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRjaGFpbi5yZXNvbHZlKHJldCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0Y2F0Y2ggKGVycikge1xuXHRcdFx0Y2hhaW4ucmVqZWN0KGVycik7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gcmVzb2x2ZShtc2cpIHtcblx0XHR2YXIgX3RoZW4sIHNlbGYgPSB0aGlzO1xuXG5cdFx0Ly8gYWxyZWFkeSB0cmlnZ2VyZWQ/XG5cdFx0aWYgKHNlbGYudHJpZ2dlcmVkKSB7IHJldHVybjsgfVxuXG5cdFx0c2VsZi50cmlnZ2VyZWQgPSB0cnVlO1xuXG5cdFx0Ly8gdW53cmFwXG5cdFx0aWYgKHNlbGYuZGVmKSB7XG5cdFx0XHRzZWxmID0gc2VsZi5kZWY7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGlmIChfdGhlbiA9IGlzVGhlbmFibGUobXNnKSkge1xuXHRcdFx0XHRzY2hlZHVsZShmdW5jdGlvbigpe1xuXHRcdFx0XHRcdHZhciBkZWZfd3JhcHBlciA9IG5ldyBNYWtlRGVmV3JhcHBlcihzZWxmKTtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0X3RoZW4uY2FsbChtc2csXG5cdFx0XHRcdFx0XHRcdGZ1bmN0aW9uICRyZXNvbHZlJCgpeyByZXNvbHZlLmFwcGx5KGRlZl93cmFwcGVyLGFyZ3VtZW50cyk7IH0sXG5cdFx0XHRcdFx0XHRcdGZ1bmN0aW9uICRyZWplY3QkKCl7IHJlamVjdC5hcHBseShkZWZfd3JhcHBlcixhcmd1bWVudHMpOyB9XG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0XHRyZWplY3QuY2FsbChkZWZfd3JhcHBlcixlcnIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSlcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRzZWxmLm1zZyA9IG1zZztcblx0XHRcdFx0c2VsZi5zdGF0ZSA9IDE7XG5cdFx0XHRcdGlmIChzZWxmLmNoYWluLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRzY2hlZHVsZShub3RpZnksc2VsZik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0Y2F0Y2ggKGVycikge1xuXHRcdFx0cmVqZWN0LmNhbGwobmV3IE1ha2VEZWZXcmFwcGVyKHNlbGYpLGVycik7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gcmVqZWN0KG1zZykge1xuXHRcdHZhciBzZWxmID0gdGhpcztcblxuXHRcdC8vIGFscmVhZHkgdHJpZ2dlcmVkP1xuXHRcdGlmIChzZWxmLnRyaWdnZXJlZCkgeyByZXR1cm47IH1cblxuXHRcdHNlbGYudHJpZ2dlcmVkID0gdHJ1ZTtcblxuXHRcdC8vIHVud3JhcFxuXHRcdGlmIChzZWxmLmRlZikge1xuXHRcdFx0c2VsZiA9IHNlbGYuZGVmO1xuXHRcdH1cblxuXHRcdHNlbGYubXNnID0gbXNnO1xuXHRcdHNlbGYuc3RhdGUgPSAyO1xuXHRcdGlmIChzZWxmLmNoYWluLmxlbmd0aCA+IDApIHtcblx0XHRcdHNjaGVkdWxlKG5vdGlmeSxzZWxmKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBpdGVyYXRlUHJvbWlzZXMoQ29uc3RydWN0b3IsYXJyLHJlc29sdmVyLHJlamVjdGVyKSB7XG5cdFx0Zm9yICh2YXIgaWR4PTA7IGlkeDxhcnIubGVuZ3RoOyBpZHgrKykge1xuXHRcdFx0KGZ1bmN0aW9uIElJRkUoaWR4KXtcblx0XHRcdFx0Q29uc3RydWN0b3IucmVzb2x2ZShhcnJbaWR4XSlcblx0XHRcdFx0LnRoZW4oXG5cdFx0XHRcdFx0ZnVuY3Rpb24gJHJlc29sdmVyJChtc2cpe1xuXHRcdFx0XHRcdFx0cmVzb2x2ZXIoaWR4LG1zZyk7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRyZWplY3RlclxuXHRcdFx0XHQpO1xuXHRcdFx0fSkoaWR4KTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBNYWtlRGVmV3JhcHBlcihzZWxmKSB7XG5cdFx0dGhpcy5kZWYgPSBzZWxmO1xuXHRcdHRoaXMudHJpZ2dlcmVkID0gZmFsc2U7XG5cdH1cblxuXHRmdW5jdGlvbiBNYWtlRGVmKHNlbGYpIHtcblx0XHR0aGlzLnByb21pc2UgPSBzZWxmO1xuXHRcdHRoaXMuc3RhdGUgPSAwO1xuXHRcdHRoaXMudHJpZ2dlcmVkID0gZmFsc2U7XG5cdFx0dGhpcy5jaGFpbiA9IFtdO1xuXHRcdHRoaXMubXNnID0gdm9pZCAwO1xuXHR9XG5cblx0ZnVuY3Rpb24gUHJvbWlzZShleGVjdXRvcikge1xuXHRcdGlmICh0eXBlb2YgZXhlY3V0b3IgIT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHR0aHJvdyBUeXBlRXJyb3IoXCJOb3QgYSBmdW5jdGlvblwiKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fX05QT19fICE9PSAwKSB7XG5cdFx0XHR0aHJvdyBUeXBlRXJyb3IoXCJOb3QgYSBwcm9taXNlXCIpO1xuXHRcdH1cblxuXHRcdC8vIGluc3RhbmNlIHNoYWRvd2luZyB0aGUgaW5oZXJpdGVkIFwiYnJhbmRcIlxuXHRcdC8vIHRvIHNpZ25hbCBhbiBhbHJlYWR5IFwiaW5pdGlhbGl6ZWRcIiBwcm9taXNlXG5cdFx0dGhpcy5fX05QT19fID0gMTtcblxuXHRcdHZhciBkZWYgPSBuZXcgTWFrZURlZih0aGlzKTtcblxuXHRcdHRoaXNbXCJ0aGVuXCJdID0gZnVuY3Rpb24gdGhlbihzdWNjZXNzLGZhaWx1cmUpIHtcblx0XHRcdHZhciBvID0ge1xuXHRcdFx0XHRzdWNjZXNzOiB0eXBlb2Ygc3VjY2VzcyA9PSBcImZ1bmN0aW9uXCIgPyBzdWNjZXNzIDogdHJ1ZSxcblx0XHRcdFx0ZmFpbHVyZTogdHlwZW9mIGZhaWx1cmUgPT0gXCJmdW5jdGlvblwiID8gZmFpbHVyZSA6IGZhbHNlXG5cdFx0XHR9O1xuXHRcdFx0Ly8gTm90ZTogYHRoZW4oLi4pYCBpdHNlbGYgY2FuIGJlIGJvcnJvd2VkIHRvIGJlIHVzZWQgYWdhaW5zdFxuXHRcdFx0Ly8gYSBkaWZmZXJlbnQgcHJvbWlzZSBjb25zdHJ1Y3RvciBmb3IgbWFraW5nIHRoZSBjaGFpbmVkIHByb21pc2UsXG5cdFx0XHQvLyBieSBzdWJzdGl0dXRpbmcgYSBkaWZmZXJlbnQgYHRoaXNgIGJpbmRpbmcuXG5cdFx0XHRvLnByb21pc2UgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcihmdW5jdGlvbiBleHRyYWN0Q2hhaW4ocmVzb2x2ZSxyZWplY3QpIHtcblx0XHRcdFx0aWYgKHR5cGVvZiByZXNvbHZlICE9IFwiZnVuY3Rpb25cIiB8fCB0eXBlb2YgcmVqZWN0ICE9IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHRcdHRocm93IFR5cGVFcnJvcihcIk5vdCBhIGZ1bmN0aW9uXCIpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0by5yZXNvbHZlID0gcmVzb2x2ZTtcblx0XHRcdFx0by5yZWplY3QgPSByZWplY3Q7XG5cdFx0XHR9KTtcblx0XHRcdGRlZi5jaGFpbi5wdXNoKG8pO1xuXG5cdFx0XHRpZiAoZGVmLnN0YXRlICE9PSAwKSB7XG5cdFx0XHRcdHNjaGVkdWxlKG5vdGlmeSxkZWYpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gby5wcm9taXNlO1xuXHRcdH07XG5cdFx0dGhpc1tcImNhdGNoXCJdID0gZnVuY3Rpb24gJGNhdGNoJChmYWlsdXJlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy50aGVuKHZvaWQgMCxmYWlsdXJlKTtcblx0XHR9O1xuXG5cdFx0dHJ5IHtcblx0XHRcdGV4ZWN1dG9yLmNhbGwoXG5cdFx0XHRcdHZvaWQgMCxcblx0XHRcdFx0ZnVuY3Rpb24gcHVibGljUmVzb2x2ZShtc2cpe1xuXHRcdFx0XHRcdHJlc29sdmUuY2FsbChkZWYsbXNnKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0ZnVuY3Rpb24gcHVibGljUmVqZWN0KG1zZykge1xuXHRcdFx0XHRcdHJlamVjdC5jYWxsKGRlZixtc2cpO1xuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXHRcdH1cblx0XHRjYXRjaCAoZXJyKSB7XG5cdFx0XHRyZWplY3QuY2FsbChkZWYsZXJyKTtcblx0XHR9XG5cdH1cblxuXHR2YXIgUHJvbWlzZVByb3RvdHlwZSA9IGJ1aWx0SW5Qcm9wKHt9LFwiY29uc3RydWN0b3JcIixQcm9taXNlLFxuXHRcdC8qY29uZmlndXJhYmxlPSovZmFsc2Vcblx0KTtcblxuXHQvLyBOb3RlOiBBbmRyb2lkIDQgY2Fubm90IHVzZSBgT2JqZWN0LmRlZmluZVByb3BlcnR5KC4uKWAgaGVyZVxuXHRQcm9taXNlLnByb3RvdHlwZSA9IFByb21pc2VQcm90b3R5cGU7XG5cblx0Ly8gYnVpbHQtaW4gXCJicmFuZFwiIHRvIHNpZ25hbCBhbiBcInVuaW5pdGlhbGl6ZWRcIiBwcm9taXNlXG5cdGJ1aWx0SW5Qcm9wKFByb21pc2VQcm90b3R5cGUsXCJfX05QT19fXCIsMCxcblx0XHQvKmNvbmZpZ3VyYWJsZT0qL2ZhbHNlXG5cdCk7XG5cblx0YnVpbHRJblByb3AoUHJvbWlzZSxcInJlc29sdmVcIixmdW5jdGlvbiBQcm9taXNlJHJlc29sdmUobXNnKSB7XG5cdFx0dmFyIENvbnN0cnVjdG9yID0gdGhpcztcblxuXHRcdC8vIHNwZWMgbWFuZGF0ZWQgY2hlY2tzXG5cdFx0Ly8gbm90ZTogYmVzdCBcImlzUHJvbWlzZVwiIGNoZWNrIHRoYXQncyBwcmFjdGljYWwgZm9yIG5vd1xuXHRcdGlmIChtc2cgJiYgdHlwZW9mIG1zZyA9PSBcIm9iamVjdFwiICYmIG1zZy5fX05QT19fID09PSAxKSB7XG5cdFx0XHRyZXR1cm4gbXNnO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgQ29uc3RydWN0b3IoZnVuY3Rpb24gZXhlY3V0b3IocmVzb2x2ZSxyZWplY3Qpe1xuXHRcdFx0aWYgKHR5cGVvZiByZXNvbHZlICE9IFwiZnVuY3Rpb25cIiB8fCB0eXBlb2YgcmVqZWN0ICE9IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHR0aHJvdyBUeXBlRXJyb3IoXCJOb3QgYSBmdW5jdGlvblwiKTtcblx0XHRcdH1cblxuXHRcdFx0cmVzb2x2ZShtc2cpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRidWlsdEluUHJvcChQcm9taXNlLFwicmVqZWN0XCIsZnVuY3Rpb24gUHJvbWlzZSRyZWplY3QobXNnKSB7XG5cdFx0cmV0dXJuIG5ldyB0aGlzKGZ1bmN0aW9uIGV4ZWN1dG9yKHJlc29sdmUscmVqZWN0KXtcblx0XHRcdGlmICh0eXBlb2YgcmVzb2x2ZSAhPSBcImZ1bmN0aW9uXCIgfHwgdHlwZW9mIHJlamVjdCAhPSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdFx0dGhyb3cgVHlwZUVycm9yKFwiTm90IGEgZnVuY3Rpb25cIik7XG5cdFx0XHR9XG5cblx0XHRcdHJlamVjdChtc2cpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRidWlsdEluUHJvcChQcm9taXNlLFwiYWxsXCIsZnVuY3Rpb24gUHJvbWlzZSRhbGwoYXJyKSB7XG5cdFx0dmFyIENvbnN0cnVjdG9yID0gdGhpcztcblxuXHRcdC8vIHNwZWMgbWFuZGF0ZWQgY2hlY2tzXG5cdFx0aWYgKFRvU3RyaW5nLmNhbGwoYXJyKSAhPSBcIltvYmplY3QgQXJyYXldXCIpIHtcblx0XHRcdHJldHVybiBDb25zdHJ1Y3Rvci5yZWplY3QoVHlwZUVycm9yKFwiTm90IGFuIGFycmF5XCIpKTtcblx0XHR9XG5cdFx0aWYgKGFyci5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBDb25zdHJ1Y3Rvci5yZXNvbHZlKFtdKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IENvbnN0cnVjdG9yKGZ1bmN0aW9uIGV4ZWN1dG9yKHJlc29sdmUscmVqZWN0KXtcblx0XHRcdGlmICh0eXBlb2YgcmVzb2x2ZSAhPSBcImZ1bmN0aW9uXCIgfHwgdHlwZW9mIHJlamVjdCAhPSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdFx0dGhyb3cgVHlwZUVycm9yKFwiTm90IGEgZnVuY3Rpb25cIik7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBsZW4gPSBhcnIubGVuZ3RoLCBtc2dzID0gQXJyYXkobGVuKSwgY291bnQgPSAwO1xuXG5cdFx0XHRpdGVyYXRlUHJvbWlzZXMoQ29uc3RydWN0b3IsYXJyLGZ1bmN0aW9uIHJlc29sdmVyKGlkeCxtc2cpIHtcblx0XHRcdFx0bXNnc1tpZHhdID0gbXNnO1xuXHRcdFx0XHRpZiAoKytjb3VudCA9PT0gbGVuKSB7XG5cdFx0XHRcdFx0cmVzb2x2ZShtc2dzKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxyZWplY3QpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRidWlsdEluUHJvcChQcm9taXNlLFwicmFjZVwiLGZ1bmN0aW9uIFByb21pc2UkcmFjZShhcnIpIHtcblx0XHR2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG5cdFx0Ly8gc3BlYyBtYW5kYXRlZCBjaGVja3Ncblx0XHRpZiAoVG9TdHJpbmcuY2FsbChhcnIpICE9IFwiW29iamVjdCBBcnJheV1cIikge1xuXHRcdFx0cmV0dXJuIENvbnN0cnVjdG9yLnJlamVjdChUeXBlRXJyb3IoXCJOb3QgYW4gYXJyYXlcIikpO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgQ29uc3RydWN0b3IoZnVuY3Rpb24gZXhlY3V0b3IocmVzb2x2ZSxyZWplY3Qpe1xuXHRcdFx0aWYgKHR5cGVvZiByZXNvbHZlICE9IFwiZnVuY3Rpb25cIiB8fCB0eXBlb2YgcmVqZWN0ICE9IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHR0aHJvdyBUeXBlRXJyb3IoXCJOb3QgYSBmdW5jdGlvblwiKTtcblx0XHRcdH1cblxuXHRcdFx0aXRlcmF0ZVByb21pc2VzKENvbnN0cnVjdG9yLGFycixmdW5jdGlvbiByZXNvbHZlcihpZHgsbXNnKXtcblx0XHRcdFx0cmVzb2x2ZShtc2cpO1xuXHRcdFx0fSxyZWplY3QpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRyZXR1cm4gUHJvbWlzZTtcbn0pO1xuIiwidmFyIFRyYW5zaXRpb24gPSByZXF1aXJlKCcuL1RyYW5zaXRpb24nKTtcblxudmFyIEhpZGVTaG93VHJhbnNpdGlvbiA9IG1vZHVsZS5leHBvcnRzID0gVHJhbnNpdGlvbi5leHRlbmQoe1xuICBzdGFydDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5uZXdDb250YWluZXJQcm9taXNlLnRoZW4odGhpcy5oaWRlU2hvdy5iaW5kKHRoaXMpKTtcbiAgfSxcblxuICBoaWRlU2hvdzogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5vbGRDb250YWluZXIuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgIHRoaXMubmV3Q29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAndmlzaWJsZSc7XG4gICAgZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AgPSAwO1xuXG4gICAgdGhpcy5kb25lKCk7XG4gIH1cbn0pO1xuIiwidmFyIFV0aWxzID0gcmVxdWlyZSgnLi9VdGlscycpO1xuXG4vLy8gVFJBTlNJVElPTlxudmFyIFRyYW5zaXRpb24gPSBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgZXh0ZW5kOiBmdW5jdGlvbihvYmopeyByZXR1cm4gVXRpbHMuZXh0ZW5kKHRoaXMsIG9iaik7IH0sXG5cbiAgb2xkQ29udGFpbmVyOiB1bmRlZmluZWQsXG4gIG5ld0NvbnRhaW5lcjogdW5kZWZpbmVkLFxuICBjb250YWluZXJMb2FkZWQ6IHVuZGVmaW5lZCxcbiAgY29tcGxldGVkOiB1bmRlZmluZWQsXG4gIC8vLyBSRU5ERVJcbiAgLy8vICogd2hhdCBzaG91bGQgaGFwcGVuIGR1cmluZyB0cmFuc2l0aW9uXG4gIC8vLyAqIG11c3QgY2FsbCByZXNvbHZlKCkgZnVuY3Rpb24gYXQgZW5kXG4gIHJlbmRlcjogZnVuY3Rpb24oKSB7fSxcblxuICAvLy8gUkVTT0xWRVxuICByZXNvbHZlOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm9sZENvbnRhaW5lci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMub2xkQ29udGFpbmVyKTtcbiAgICB0aGlzLmNvbXBsZXRlZC5yZXNvbHZlKCk7XG4gIH0sXG5cbiAgLy8vIElOSVRcbiAgLy8vIG9sZENvbnRhaW5lciA9IE5vZGVcbiAgLy8vIG5ld0NvbnRhaW5lciA9IFByb21pc2VcbiAgaW5pdDogZnVuY3Rpb24ob2xkQ29udGFpbmVyLCBwcm9taXNlZENvbnRhaW5lcikge1xuICAgIHZhciBfdGhpcyA9IHRoaXM7XG4gICAgdmFyIExvYWQgPSBVdGlscy5kZWZlcnJlZCgpO1xuXG4gICAgdGhpcy5jb21wbGV0ZWQgPSBVdGlscy5kZWZlcnJlZCgpO1xuICAgIHRoaXMub2xkQ29udGFpbmVyID0gb2xkQ29udGFpbmVyO1xuICAgIHRoaXMuY29udGFpbmVyTG9hZGVkID0gTG9hZC5wcm9taXNlO1xuXG4gICAgdGhpcy5yZW5kZXIoKTtcblxuICAgIHByb21pc2VkQ29udGFpbmVyLnRoZW4oZnVuY3Rpb24obmV3Q29udGFpbmVyKSB7XG4gICAgICBfdGhpcy5uZXdDb250YWluZXIgPSBuZXdDb250YWluZXI7XG4gICAgICBMb2FkLnJlc29sdmUoKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzLmNvbXBsZXRlZC5wcm9taXNlO1xuICB9LFxuXG59O1xuIiwiLyoqXG4gKiBKdXN0IGFuIG9iamVjdCB3aXRoIHNvbWUgaGVscGZ1bCBmdW5jdGlvbnNcbiAqXG4gKiBAdHlwZSB7T2JqZWN0fVxuICogQG5hbWVzcGFjZSBCYXJiYS5VdGlsc1xuICovXG52YXIgVXRpbHMgPSB7XG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGN1cnJlbnQgdXJsXG4gICAqXG4gICAqIEBtZW1iZXJPZiBCYXJiYS5VdGlsc1xuICAgKiBAcmV0dXJuIHtTdHJpbmd9IGN1cnJlbnRVcmxcbiAgICovXG4gIGdldEN1cnJlbnRVcmw6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2wgKyAnLy8nICtcbiAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLmhvc3QgK1xuICAgICAgICAgICB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgK1xuICAgICAgICAgICB3aW5kb3cubG9jYXRpb24uc2VhcmNoO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHaXZlbiBhbiB1cmwsIHJldHVybiBpdCB3aXRob3V0IHRoZSBoYXNoXG4gICAqXG4gICAqIEBtZW1iZXJPZiBCYXJiYS5VdGlsc1xuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHVybFxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IG5ld0NsZWFuVXJsXG4gICAqL1xuICBjbGVhbkxpbms6IGZ1bmN0aW9uKHVybCkge1xuICAgIHJldHVybiB1cmwucmVwbGFjZSgvIy4qLywgJycpO1xuICB9LFxuXG4gIC8vLyB3aGV0aGVyIGEgbGluayBzaG91bGQgYmUgZm9sbG93ZWRcbiAgdmFsaWRMaW5rOiBmdW5jdGlvbihlbGVtZW50LCBldmVudCkge1xuICAgIGlmICghaGlzdG9yeS5wdXNoU3RhdGUpIHJldHVybiBmYWxzZTtcbiAgICAvLy8gdXNlclxuICAgIGlmICghZWxlbWVudCB8fCAhZWxlbWVudC5ocmVmKSByZXR1cm4gZmFsc2U7XG4gICAgLy8vIG1pZGRsZSBjbGljaywgY21kIGNsaWNrLCBhbmQgY3RybCBjbGlja1xuICAgIGlmIChldmVudC53aGljaCA+IDEgfHwgZXZlbnQubWV0YUtleSB8fCBldmVudC5jdHJsS2V5IHx8IGV2ZW50LnNoaWZ0S2V5IHx8IGV2ZW50LmFsdEtleSkgcmV0dXJuIGZhbHNlO1xuICAgIC8vLyBpZ25vcmUgdGFyZ2V0IHdpdGggX2JsYW5rIHRhcmdldFxuICAgIGlmIChlbGVtZW50LnRhcmdldCAmJiBlbGVtZW50LnRhcmdldCA9PT0gJ19ibGFuaycpIHJldHVybiBmYWxzZTtcbiAgICAvLy8gY2hlY2sgaWYgaXQncyB0aGUgc2FtZSBkb21haW5cbiAgICBpZiAod2luZG93LmxvY2F0aW9uLnByb3RvY29sICE9PSBlbGVtZW50LnByb3RvY29sIHx8IHdpbmRvdy5sb2NhdGlvbi5ob3N0bmFtZSAhPT0gZWxlbWVudC5ob3N0bmFtZSkgcmV0dXJuIGZhbHNlO1xuICAgIC8vLyBjaGVjayBpZiB0aGUgcG9ydCBpcyB0aGUgc2FtZVxuICAgIGlmIChVdGlscy5nZXRQb3J0KCkgIT09IFV0aWxzLmdldFBvcnQoZWxlbWVudC5wb3J0KSkgcmV0dXJuIGZhbHNlO1xuICAgIC8vLyBpZ25vcmUgY2FzZSB3aGVuIGEgaGFzaCBpcyBiZWluZyB0YWNrZWQgb24gdGhlIGN1cnJlbnQgdXJsXG4gICAgaWYgKGVsZW1lbnQuaHJlZi5pbmRleE9mKCcjJykgPiAtMSkgcmV0dXJuIGZhbHNlO1xuICAgIC8vLyBpbiBjYXNlIHlvdSdyZSB0cnlpbmcgdG8gbG9hZCB0aGUgc2FtZSBwYWdlXG4gICAgaWYgKFV0aWxzLmNsZWFuTGluayhlbGVtZW50LmhyZWYpID09IFV0aWxzLmNsZWFuTGluayhsb2NhdGlvbi5ocmVmKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChlbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnbm8tYmFyYmEnKSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUaW1lIGluIG1pbGxpc2Vjb25kIGFmdGVyIHRoZSB4aHIgcmVxdWVzdCBnb2VzIGluIHRpbWVvdXRcbiAgICpcbiAgICogQG1lbWJlck9mIEJhcmJhLlV0aWxzXG4gICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAqIEBkZWZhdWx0XG4gICAqL1xuICB4aHJUaW1lb3V0OiA1MDAwLFxuXG4gIC8qKlxuICAgKiBTdGFydCBhbiBYTUxIdHRwUmVxdWVzdCgpIGFuZCByZXR1cm4gYSBQcm9taXNlXG4gICAqXG4gICAqIEBtZW1iZXJPZiBCYXJiYS5VdGlsc1xuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHVybFxuICAgKiBAcmV0dXJuIHtQcm9taXNlfVxuICAgKi9cbiAgeGhyOiBmdW5jdGlvbih1cmwpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSB0aGlzLmRlZmVycmVkKCk7XG4gICAgdmFyIHJlcSA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgcmVxLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHJlcS5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgIGlmIChyZXEuc3RhdHVzID09PSAyMDApIHtcbiAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucmVzb2x2ZShyZXEucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucmVqZWN0KG5ldyBFcnJvcigneGhyOiBIVFRQIGNvZGUgaXMgbm90IDIwMCcpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICByZXEub250aW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZGVmZXJyZWQucmVqZWN0KG5ldyBFcnJvcigneGhyOiBUaW1lb3V0IGV4Y2VlZGVkJykpO1xuICAgIH07XG5cbiAgICByZXEub3BlbignR0VUJywgdXJsKTtcbiAgICByZXEudGltZW91dCA9IHRoaXMueGhyVGltZW91dDtcbiAgICByZXEuc2V0UmVxdWVzdEhlYWRlcigneC1iYXJiYScsICd5ZXMnKTtcbiAgICByZXEuc2VuZCgpO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEdldCBvYmogYW5kIHByb3BzIGFuZCByZXR1cm4gYSBuZXcgb2JqZWN0IHdpdGggdGhlIHByb3BlcnR5IG1lcmdlZFxuICAgKlxuICAgKiBAbWVtYmVyT2YgQmFyYmEuVXRpbHNcbiAgICogQHBhcmFtICB7b2JqZWN0fSBvYmpcbiAgICogQHBhcmFtICB7b2JqZWN0fSBwcm9wc1xuICAgKiBAcmV0dXJuIHtvYmplY3R9XG4gICAqL1xuICBleHRlbmQ6IGZ1bmN0aW9uKG9iaiwgcHJvcHMpIHtcbiAgICB2YXIgbmV3T2JqID0gT2JqZWN0LmNyZWF0ZShvYmopO1xuXG4gICAgZm9yKHZhciBwcm9wIGluIHByb3BzKSB7XG4gICAgICBpZihwcm9wcy5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICBuZXdPYmpbcHJvcF0gPSBwcm9wc1twcm9wXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3T2JqO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBuZXcgXCJEZWZlcnJlZFwiIG9iamVjdFxuICAgKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL01vemlsbGEvSmF2YVNjcmlwdF9jb2RlX21vZHVsZXMvUHJvbWlzZS5qc20vRGVmZXJyZWRcbiAgICpcbiAgICogQHJldHVybiB7RGVmZXJyZWR9XG4gICAqL1xuICBkZWZlcnJlZDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMucmVzb2x2ZSA9IG51bGw7XG4gICAgICB0aGlzLnJlamVjdCA9IG51bGw7XG5cbiAgICAgIHRoaXMucHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICB0aGlzLnJlc29sdmUgPSByZXNvbHZlO1xuICAgICAgICB0aGlzLnJlamVjdCA9IHJlamVjdDtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfTtcbiAgfSxcblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBwb3J0IG51bWJlciBub3JtYWxpemVkLCBldmVudHVhbGx5IHlvdSBjYW4gcGFzcyBhIHN0cmluZyB0byBiZSBub3JtYWxpemVkLlxuICAgKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHBcbiAgICogQHJldHVybiB7SW50fSBwb3J0XG4gICAqL1xuICBnZXRQb3J0OiBmdW5jdGlvbihwKSB7XG4gICAgdmFyIHBvcnQgPSB0eXBlb2YgcCAhPT0gJ3VuZGVmaW5lZCcgPyBwIDogd2luZG93LmxvY2F0aW9uLnBvcnQ7XG4gICAgdmFyIHByb3RvY29sID0gd2luZG93LmxvY2F0aW9uLnByb3RvY29sO1xuXG4gICAgaWYgKHBvcnQgIT0gJycpXG4gICAgICByZXR1cm4gcGFyc2VJbnQocG9ydCk7XG5cbiAgICBpZiAocHJvdG9jb2wgPT09ICdodHRwOicpXG4gICAgICByZXR1cm4gODA7XG5cbiAgICBpZiAocHJvdG9jb2wgPT09ICdodHRwczonKVxuICAgICAgcmV0dXJuIDQ0MztcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBVdGlscztcbiIsIi8qKlxuICogTGl0dGxlIERpc3BhdGNoZXIgaW5zcGlyZWQgYnkgTWljcm9FdmVudC5qc1xuICpcbiAqIEBuYW1lc3BhY2UgQmFyYmEuRGlzcGF0Y2hlclxuICogQHR5cGUge09iamVjdH1cbiAqL1xudmFyIERpc3BhdGNoZXIgPSB7XG4gIC8qKlxuICAgKiBFdmVudCBhcnJheVxuICAgKlxuICAgKiBAbWVtYmVyT2YgQmFyYmEuRGlzcGF0Y2hlclxuICAgKiBAcmVhZE9ubHlcbiAgICogQHR5cGUge09iamVjdH1cbiAgICovXG4gIGV2ZW50czoge30sXG5cbiAgLyoqXG4gICAqIEJpbmQgYSBjYWxsYmFjayB0byBhbiBldmVudFxuICAgKlxuICAgKiBAbWVtYmVyT2YgQmFyYmEuRGlzcGF0Y2hlclxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IGV2ZW50TmFtZVxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gZnVuY3Rpb25cbiAgICovXG4gIG9uKGUsIGYpIHtcbiAgICB0aGlzLmV2ZW50c1tlXSA9IHRoaXMuZXZlbnRzW2VdIHx8IFtdO1xuICAgIHRoaXMuZXZlbnRzW2VdLnB1c2goZik7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFVuYmluZCBldmVudFxuICAgKlxuICAgKiBAbWVtYmVyT2YgQmFyYmEuRGlzcGF0Y2hlclxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IGV2ZW50TmFtZVxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gZnVuY3Rpb25cbiAgICovXG4gIG9mZihlLCBmKSB7XG4gICAgaWYoZSBpbiB0aGlzLmV2ZW50cyA9PT0gZmFsc2UpXG4gICAgICByZXR1cm47XG5cbiAgICB0aGlzLmV2ZW50c1tlXS5zcGxpY2UodGhpcy5ldmVudHNbZV0uaW5kZXhPZihmKSwgMSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEZpcmUgdGhlIGV2ZW50IHJ1bm5pbmcgYWxsIHRoZSBldmVudCBhc3NvY2lhdGVkXG4gICAqXG4gICAqIEBtZW1iZXJPZiBCYXJiYS5EaXNwYXRjaGVyXG4gICAqIEBwYXJhbSAge1N0cmluZ30gZXZlbnROYW1lXG4gICAqIEBwYXJhbSB7Li4uKn0gYXJnc1xuICAgKi9cbiAgdHJpZ2dlcihlKSB7Ly9lLCAuLi5hcmdzXG4gICAgaWYgKGUgaW4gdGhpcy5ldmVudHMgPT09IGZhbHNlKVxuICAgICAgcmV0dXJuO1xuXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IHRoaXMuZXZlbnRzW2VdLmxlbmd0aDsgaSsrKXtcbiAgICAgIHRoaXMuZXZlbnRzW2VdW2ldLmFwcGx5KHRoaXMsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgIH1cbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBEaXNwYXRjaGVyO1xuIiwiLy8vIFByb21pc2UgcG9seWZpbGwgaHR0cHM6Ly9naXRodWIuY29tL3RheWxvcmhha2VzL3Byb21pc2UtcG9seWZpbGxcbi8vLyBhbHRlcm5hdGl2ZSAtLSBodHRwczovL2dpdGh1Yi5jb20vZ2V0aWZ5L25hdGl2ZS1wcm9taXNlLW9ubHlcbmlmICh0eXBlb2YgUHJvbWlzZSAhPT0gJ2Z1bmN0aW9uJykgeyB3aW5kb3cuUHJvbWlzZSA9IHJlcXVpcmUoJ25hdGl2ZS1wcm9taXNlLW9ubHknKTsgfVxuXG4vLyBnZW5lcmFsXG52YXIgRGlzcGF0Y2hlciAgICAgICAgPSByZXF1aXJlKCcuL2Rpc3BhdGNoZXInKTtcblxuLy8gcGpheCBzcGVjaWZpYyBzdHVmZlxudmFyIENhY2hlICAgICAgPSByZXF1aXJlKCcuL3BqYXgvY2FjaGUnKTtcbnZhciBEb20gICAgICAgID0gcmVxdWlyZSgnLi9wamF4L2RvbScpO1xudmFyIEhpc3RvcnkgICAgPSByZXF1aXJlKCcuL3BqYXgvaGlzdG9yeScpO1xudmFyIFByZWZldGNoICAgPSByZXF1aXJlKCcuL3BqYXgvcHJlZmV0Y2gnKTtcbnZhciBUcmFuc2l0aW9uID0gcmVxdWlyZSgnLi9wamF4L3RyYW5zaXRpb24nKTtcbnZhciBWaWV3ICAgICAgID0gcmVxdWlyZSgnLi9wamF4L3ZpZXcnKTtcbnZhciBVdGlscyAgICAgID0gcmVxdWlyZSgnLi9wamF4L3V0aWxzJyk7XG5cblxuLy8vIGdldCBjdXJyZW50IFVSTFxuZnVuY3Rpb24gZ2V0Q3VycmVudFVybCgpIHsgcmV0dXJuIFV0aWxzLmNsZWFuTGluayggVXRpbHMuZ2V0Q3VycmVudFVybCgpICk7IH1cblxuLy8gVE9ETzogcmVuYW1lIHRoZSBmb2xsb3dpbmcgdHdvIGZ1bmN0aW9uc1xuLy8vIGdvIHRvXG4vLyBmdW5jdGlvbiBnb1RvKHVybCkge1xuLy8gICB3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUobnVsbCwgbnVsbCwgdXJsKTtcbi8vICAgb25TdGF0ZUNoYW5nZSgpO1xuLy8gfVxuLy8vIGZvcmNlIGdvIHRvXG5mdW5jdGlvbiBmb3JjZUdvVG8odXJsKSB7IHdpbmRvdy5sb2NhdGlvbiA9IHVybDsgfVxuXG4vLy8gbGlua0NsaWNrIGhhbmRsZXJcbmZ1bmN0aW9uIG9uTGlua0NsaWNrKGV2ZW50KSB7XG4gIC8vIHJlc29sdmUgdGhlIGVsZW1lbnRcbiAgdmFyIGVsZW1lbnQgPSBldmVudC50YXJnZXQ7XG4gIHdoaWxlIChlbGVtZW50ICYmICFlbGVtZW50LmhyZWYpIHsgZWxlbWVudCA9IGVsZW1lbnQucGFyZW50Tm9kZTsgfVxuICAvLyBjaGVjayBpZiBlbGVtZW50IGlzIHZhbGlkXG4gIGlmIChVdGlscy52YWxpZExpbmsoZWxlbWVudCwgZXZlbnQpKSB7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAvLyBmaXJlIGFuZCB1cGRhdGVcbiAgICBEaXNwYXRjaGVyLnRyaWdnZXIoJ2xpbmtDbGljaycsIGVsZW1lbnQpO1xuICAgIHdpbmRvdy5oaXN0b3J5LnB1c2hTdGF0ZShudWxsLCBudWxsLCBlbGVtZW50LmhyZWYpO1xuICAgIG9uU3RhdGVDaGFuZ2UoKTtcbiAgfVxufVxuXG4vLy8gc3RhdGVDaGFuZ2UgaGFuZGxlclxuZnVuY3Rpb24gb25TdGF0ZUNoYW5nZSgpIHtcblxuICBjb25zb2xlLmxvZyhIaXN0b3J5LmN1cnJTdGF0dXMoKSk7XG5cbiAgLy8gZ2V0IG5ldyBVUkxcbiAgdmFyIG5ld1VybCA9IGdldEN1cnJlbnRVcmwoKTtcbiAgLy8gYmFpbCBvdXQsIGlmIGN1cnJlbnQgVVJMIGlzIHNhbWUgYXMgbmV3IFVSTFxuICBpZiAoSGlzdG9yeS5jdXJyU3RhdHVzKCkudXJsID09PSBuZXdVcmwpIHJldHVybiBmYWxzZTtcbiAgLy8gY2hlY2sgaWYgdHJhbnNpdGlvbiBpbiBwcm9ncmVzc1xuICBpZiAoUGpheC50cmFuc2l0aW9uSW5Qcm9ncmVzcykge1xuICAgIC8vLyBpZiB0cmFucyBpbiBwcm9nLCBmb3JjZSBnbyB0byBuZXcgVVJMXG4gICAgLy8vIE5CLiB0aGlzIGlzIHdoZXJlIHdlJ2QgaGF2ZSB0byBjYW5jZWwgdGhlIGN1cnJlbnQgdHJhbnNpdGlvbiBhbmQgc3RhcnQgYW5vdGhlciBvbmVcbiAgICBmb3JjZUdvVG8obmV3VXJsKTtcbiAgfVxuICAvLyBvdGhlcndpc2UuLi5cbiAgLy8gZmlyZSBpbnRlcm5hbCBldmVudHNcbiAgRGlzcGF0Y2hlci50cmlnZ2VyKCdzdGF0ZUNoYW5nZScsIEhpc3RvcnkuY3VyclN0YXR1cygpLCBIaXN0b3J5LnByZXZTdGF0dXMoKSk7XG4gIC8vIGFkZCBVUkwgdG8gaW50ZXJuYWwgaGlzdG9yeSBtYW5hZ2VyXG4gIEhpc3RvcnkuYWRkKG5ld1VybCk7XG4gIC8vIGdldCB0aGUgcHJvbWlzZSBmb3IgdGhlIG5ldyBjb250YWluZXJcbiAgdmFyIGdvdENvbnRhaW5lciA9IFBqYXgubG9hZChuZXdVcmwpO1xuICAvLyB0aGlzIHNob3VsZCBub3QgYXQgYWxsIGJlIG5lY2Vzc2FyeVxuICB2YXIgdHJhbnNpdGlvbiA9IE9iamVjdC5jcmVhdGUoUGpheC5nZXRUcmFuc2l0aW9uKCkpO1xuICBQamF4LnRyYW5zaXRpb25JblByb2dyZXNzID0gdHJ1ZTtcbiAgdmFyIHRyYW5zaXRpb25JbnN0YW5jZSA9IHRyYW5zaXRpb24uaW5pdChcbiAgICBEb20uZ2V0Q29udGFpbmVyKCksXG4gICAgZ290Q29udGFpbmVyXG4gICk7XG4gIGdvdENvbnRhaW5lci50aGVuKCBvbkNvbnRhaW5lckxvYWQgKTtcbiAgdHJhbnNpdGlvbkluc3RhbmNlLnRoZW4oIG9uVHJhbnNpdGlvbkVuZCApO1xufVxuXG4vLy8gY29udGFpbmVyTG9hZCBoYW5kbGVyXG5mdW5jdGlvbiBvbkNvbnRhaW5lckxvYWQoY29udGFpbmVyKSB7XG4gIHZhciBjdXJyU3RhdHVzID0gSGlzdG9yeS5jdXJyU3RhdHVzKCk7XG4gIGN1cnJTdGF0dXMubmFtZXNwYWNlID0gRG9tLmdldE5hbWVzcGFjZShjb250YWluZXIpO1xuICBEaXNwYXRjaGVyLnRyaWdnZXIoJ2NvbnRhaW5lckxvYWQnLFxuICAgIEhpc3RvcnkuY3VyclN0YXR1cygpLFxuICAgIEhpc3RvcnkucHJldlN0YXR1cygpLFxuICAgIGNvbnRhaW5lclxuICApO1xufVxuXG4vLy8gdHJhbnNpdGlvbkVuZCBoYW5kbGVyXG5mdW5jdGlvbiBvblRyYW5zaXRpb25FbmQoKSB7XG4gIFBqYXgudHJhbnNpdGlvbkluUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgRGlzcGF0Y2hlci50cmlnZ2VyKCd0cmFuc2l0aW9uRW5kJyxcbiAgICBIaXN0b3J5LmN1cnJTdGF0dXMoKSxcbiAgICBIaXN0b3J5LnByZXZTdGF0dXMoKVxuICApO1xufVxuXG4vLy8gUEpBWFxudmFyIFBqYXggPSBtb2R1bGUuZXhwb3J0cyA9IHtcblxuICAvLy8gd2hldGhlciB0byB1c2UgY2FjaGVcbiAgY2FjaGVFbmFibGVkOiB0cnVlLFxuXG4gIC8vLyB3aGV0aGVyIHRyYW5zaXRpb24gaXMgaW4gcHJvZ3Jlc3NcbiAgdHJhbnNpdGlvbkluUHJvZ3Jlc3M6IGZhbHNlLFxuXG4gIC8vLyB3aGF0IHRyYW5zaXRpb24gdG8gdXNlXG4gIC8vLyAqIGVpdGhlciBjaGFuZ2UgdGhpcy4uLlxuICBkZWZhdWx0VHJhbnNpdGlvbjogcmVxdWlyZSgnLi9QamF4L0hpZGVTaG93VHJhbnNpdGlvbicpLFxuICAvLy8gLi4ub3IgY2hhbmdlIHRoaXMsIHRvIGFmZmVjdCBkZWZhdWx0c1xuICBnZXRUcmFuc2l0aW9uOiBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXMuZGVmYXVsdFRyYW5zaXRpb247IH0sXG5cbiAgLy8vIGluaXRpYWxpemVcbiAgaW5pdDogZnVuY3Rpb24oKSB7XG5cbiAgICAvLyBnZXQgdGhlIGNvbnRhaW5lclxuICAgIHZhciBjb250YWluZXIgPSBEb20uZ2V0Q29udGFpbmVyKCk7XG5cbiAgICBIaXN0b3J5LmFkZChcbiAgICAgIGdldEN1cnJlbnRVcmwoKSxcbiAgICAgIERvbS5nZXROYW1lc3BhY2UoY29udGFpbmVyKVxuICAgICk7XG5cbiAgICAvLyBmaXJlIGN1c3RvbSBldmVudHMgZm9yIHRoZSBjdXJyZW50IHZpZXcuXG4gICAgRGlzcGF0Y2hlci50cmlnZ2VyKCdzdGF0ZUNoYW5nZScsIEhpc3RvcnkuY3VyclN0YXR1cygpKTtcbiAgICBEaXNwYXRjaGVyLnRyaWdnZXIoJ2NvbnRhaW5lckxvYWQnLCBIaXN0b3J5LmN1cnJTdGF0dXMoKSwge30sIGNvbnRhaW5lcik7XG4gICAgRGlzcGF0Y2hlci50cmlnZ2VyKCd0cmFuc2l0aW9uRW5kJywgSGlzdG9yeS5jdXJyU3RhdHVzKCkpO1xuXG4gICAgLy8gYmluZCBuYXRpdmUgZXZlbnRzXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBvbkxpbmtDbGljayk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgb25TdGF0ZUNoYW5nZSk7XG4gIH0sXG5cbiAgLy8vIGxvYWQgYSBuZXcgcGFnZTsgcmV0dXJuIFByb21pc2VcbiAgbG9hZDogZnVuY3Rpb24odXJsKSB7XG4gICAgdmFyIGRlZmVycmVkID0gVXRpbHMuZGVmZXJyZWQoKTtcbiAgICB2YXIgeGhyID0gQ2FjaGUuZ2V0KHVybCk7XG4gICAgaWYgKCF4aHIpIHtcbiAgICAgIHhociA9IFV0aWxzLnhocih1cmwpO1xuICAgICAgQ2FjaGUuc2V0KHVybCwgeGhyKTtcbiAgICB9XG4gICAgeGhyLnRoZW4oXG4gICAgICAvLyBzdWNjZXNzXG4gICAgICBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIHZhciBjb250YWluZXIgPSBEb20ucGFyc2VSZXNwb25zZShkYXRhKTtcbiAgICAgICAgRG9tLnB1dENvbnRhaW5lcihjb250YWluZXIpO1xuICAgICAgICBpZiAoIVBqYXguY2FjaGVFbmFibGVkKSBDYWNoZS5yZXNldCgpO1xuICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKGNvbnRhaW5lcik7XG4gICAgICB9LFxuICAgICAgLy8gZXJyb3JcbiAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICB3aW5kb3cubG9jYXRpb24gPSB1cmw7XG4gICAgICAgIGRlZmVycmVkLnJlamVjdCgpO1xuICAgICAgfVxuICAgICk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gIH0sXG5cbiAgLy8vIGV4cG9zdXJlIG9mIG90aGVyIG9iamVjdHNcbiAgQ2FjaGU6IENhY2hlLFxuICBEb206IERvbSxcbiAgSGlzdG9yeTogSGlzdG9yeSxcbiAgUHJlZmV0Y2g6IFByZWZldGNoLFxuICBUcmFuc2l0aW9uOiBUcmFuc2l0aW9uLFxuICBVdGlsczogVXRpbHMsXG4gIFZpZXc6IFZpZXdcbn07XG4iLCIvLy8gQ0FDSEVcbnZhciBDYWNoZSA9IG1vZHVsZS5leHBvcnRzID0ge1xuICAvLyBleHRlbmQgZnVuY3Rpb24gLS0gbmVjZXNzYXJ5P1xuICBleHRlbmQ6IGZ1bmN0aW9uKG9iaikgeyByZXR1cm4gVXRpbHMuZXh0ZW5kKHRoaXMsIG9iaik7IH0sXG4gIC8vIGhvbGRlclxuICBkYXRhOiB7fSxcbiAgLy8gc2V0XG4gIHNldDogZnVuY3Rpb24oa2V5LCB2YWwpIHsgdGhpcy5kYXRhW2tleV0gPSB2YWw7IH0sXG4gIC8vIGdldFxuICBnZXQ6IGZ1bmN0aW9uKGtleSkgeyByZXR1cm4gdGhpcy5kYXRhW2tleV07IH0sXG4gIC8vIHJlc2V0XG4gIHJlc2V0OiBmdW5jdGlvbigpIHsgdGhpcy5kYXRhID0ge307IH1cbn07XG4iLCIvLy8gRE9NXG52YXIgRG9tID0gbW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgLy8vIGRhdGEgTkFNRVNQQUNFIGRlZmF1bHRcbiAgZGF0YU5hbWVzcGFjZTogJ25hbWVzcGFjZScsXG5cbiAgLy8vIHdyYXBwZXIgSUQgZGVmYXVsdFxuICAvLy8gKiB0aGVyZSB3aWxsIG9ubHkgZXZlciBiZSBvbmUgb2YgdGhlc2VcbiAgd3JhcHBlcklkOiAncGpheC13cmFwcGVyJyxcblxuICAvLy8gY29udGFpbmVyIENMQVNTIGRlZmF1bHRcbiAgLy8vICogdGhlcmUgd2lsbCBhdCBhIHBvaW50IGJlIHR3byBvZiB0aGVzZSBpbiB0aGUgRE9NIChvbGQgYW5kIG5ldylcbiAgY29udGFpbmVyQ2xhc3M6ICdwamF4LWNvbnRhaW5lcicsXG5cbiAgLy8vIHBhcnNlIHRoZSByZXNwb25zZSBmcm9tIFhIUlxuICAvLy8gMS4gcGxhY2UgY29udGVudCBpbiBkZXRhY2hlZCBkaXZcbiAgLy8vIDIuIHBhcnNlIG91dCA8dGl0bGU+IGVsZW1lbnQgdGV4dCBhbmQgc2V0IGl0XG4gIC8vLyAzLiBleHRyYWN0IHRoZSBuZXdDb250YWluZXIgZWxlbWVudFxuICBwYXJzZVJlc3BvbnNlOiBmdW5jdGlvbihyZXNwb25zZVRleHQpIHtcbiAgICB2YXIgd3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHdyYXBwZXIuaW5uZXJIVE1MID0gcmVzcG9uc2VUZXh0O1xuICAgIHZhciB0aXRsZUVsID0gd3JhcHBlci5xdWVyeVNlbGVjdG9yKCd0aXRsZScpO1xuICAgIGlmICh0aXRsZUVsKVxuICAgICAgZG9jdW1lbnQudGl0bGUgPSB0aXRsZUVsLnRleHRDb250ZW50O1xuICAgIHJldHVybiB0aGlzLmdldENvbnRhaW5lcih3cmFwcGVyKTtcbiAgfSxcblxuICAvLy8gZ2V0IHRoZSB3cmFwcGVyXG4gIGdldFdyYXBwZXI6IGZ1bmN0aW9uKCkgeyByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodGhpcy53cmFwcGVySWQpOyB9LFxuXG4gIC8vLyBnZXQgdGhlIGNvbnRhaW5lclxuICAvLy8gKiBhY2NlcHQgYSBnaXZlbiB3cmFwcGVyLCBvciB1c2UgZGVmYXVsdCB3cmFwcGVyXG4gIGdldENvbnRhaW5lcjogZnVuY3Rpb24od3JhcHBlcikge1xuICAgIGlmICghd3JhcHBlcilcbiAgICAgIHdyYXBwZXIgPSB0aGlzLmdldFdyYXBwZXIoKTtcbiAgICBpZiAoIXdyYXBwZXIpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0JhcmJhLmpzOiBET00gbm90IHJlYWR5IScpO1xuICAgIHZhciBjb250YWluZXIgPSB3cmFwcGVyLnF1ZXJ5U2VsZWN0b3IoJy4nICsgdGhpcy5jb250YWluZXJDbGFzcyk7XG4gICAgaWYgKGNvbnRhaW5lciAmJiBjb250YWluZXIuanF1ZXJ5KVxuICAgICAgY29udGFpbmVyID0gY29udGFpbmVyWzBdO1xuICAgIGlmICghY29udGFpbmVyKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdCYXJiYS5qczogbm8gY29udGFpbmVyIGZvdW5kJyk7XG4gICAgcmV0dXJuIGNvbnRhaW5lcjtcbiAgfSxcblxuICAvLy8gZ2V0IHRoZSBuYW1lc3BhY2Ugb2YgdGhlIGNvbnRhaW5lclxuICBnZXROYW1lc3BhY2U6IGZ1bmN0aW9uKGNvbnRhaW5lcikge1xuICAgIGlmIChjb250YWluZXIgJiYgY29udGFpbmVyLmRhdGFzZXQpIHtcbiAgICAgIHJldHVybiBjb250YWluZXIuZGF0YXNldFt0aGlzLmRhdGFOYW1lc3BhY2VdO1xuICAgIH0gZWxzZSBpZiAoY29udGFpbmVyKSB7XG4gICAgICByZXR1cm4gY29udGFpbmVyLmdldEF0dHJpYnV0ZSgnZGF0YS0nICsgdGhpcy5kYXRhTmFtZXNwYWNlKTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG5cbiAgLy8vIHB1dCB0aGUgY29udGFpbmVyIGluIHRvIHRoZSB3cmFwcGVyLCB3aXRoIHZpc2liaWxpdHkgJ2hpZGRlbidcbiAgcHV0Q29udGFpbmVyOiBmdW5jdGlvbihjb250YWluZXIpIHtcbiAgICBjb250YWluZXIuc3R5bGUudmlzaWJpbGl0eSA9ICdoaWRkZW4nO1xuICAgIHRoaXMuZ2V0V3JhcHBlcigpLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG4gIH1cbn07XG4iLCIvLy8gSElTVE9SWVxudmFyIEhpc3RvcnkgPSBtb2R1bGUuZXhwb3J0cyA9IHtcblxuICBoaXN0b3J5OiBbXSxcblxuICBhZGQ6IGZ1bmN0aW9uKHVybCwgbmFtZXNwYWNlKSB7XG4gICAgaWYgKCFuYW1lc3BhY2UpXG4gICAgICBuYW1lc3BhY2UgPSB1bmRlZmluZWQ7XG5cbiAgICB0aGlzLmhpc3RvcnkucHVzaCh7XG4gICAgICB1cmw6IHVybCxcbiAgICAgIG5hbWVzcGFjZTogbmFtZXNwYWNlXG4gICAgfSk7XG4gIH0sXG5cbiAgbGFzdDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaGlzdG9yeVt0aGlzLmhpc3RvcnkubGVuZ3RoIC0gMV07XG4gIH0sXG5cbiAgY3VyclN0YXR1czogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuaGlzdG9yeVt0aGlzLmhpc3RvcnkubGVuZ3RoIC0gMV07XG4gIH0sXG5cbiAgcHJldlN0YXR1czogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGhpc3RvcnkgPSB0aGlzLmhpc3Rvcnk7XG5cbiAgICBpZiAoaGlzdG9yeS5sZW5ndGggPCAyKVxuICAgICAgcmV0dXJuIG51bGw7XG5cbiAgICByZXR1cm4gaGlzdG9yeVtoaXN0b3J5Lmxlbmd0aCAtIDJdO1xuICB9XG59O1xuXG4iLCJ2YXIgVXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG52YXIgQ2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG5cbmZ1bmN0aW9uIG9uTGlua0VudGVyKGV2ZW50KSB7XG4gIC8vIGdldCBldmVudCB0YXJnZXRcbiAgdmFyIGVsID0gZXZlbnQudGFyZ2V0O1xuICAvLyB0cmF2ZXJzZSB1cCB1bnRpbCB2YWxpZCBocmVmXG4gIHdoaWxlIChlbCAmJiAhZWwuaHJlZikgeyBlbCA9IGVsLnBhcmVudE5vZGU7IH1cbiAgLy8gaWYgbm90aGluZyBmb3VuZCwgYmFpbFxuICBpZiAoIWVsKSB7IHJldHVybjsgfVxuICAvLyBnZXQgdGhlIFVSTFxuICB2YXIgdXJsID0gZWwuaHJlZjtcbiAgLy8gaWYgbGluayBpcyB2YWxpZC4uLlxuICBpZiAoVXRpbHMudmFsaWRMaW5rKGVsLCBldmVudCkgJiYgIUNhY2hlLmdldCh1cmwpKSB7XG4gICAgLy8gZ2V0IHRoZSBjb250ZW50XG4gICAgdmFyIHhociA9IFV0aWxzLnhocih1cmwpO1xuICAgIC8vIGJ1bmcgaXQgaW4gdGhlIGNhY2hlXG4gICAgQ2FjaGUuc2V0KHVybCwgeGhyKTtcbiAgfVxufVxuXG4vLy8gUFJFRkVUQ0hcbnZhciBQcmVmZXRjaCA9IG1vZHVsZS5leHBvcnRzID0ge1xuICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICBkb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlb3ZlcicsIG9uTGlua0VudGVyKTtcbiAgICBkb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCBvbkxpbmtFbnRlcik7XG4gIH1cbn07XG4iLCJ2YXIgVXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbi8vLyBUUkFOU0lUSU9OXG52YXIgVHJhbnNpdGlvbiA9IG1vZHVsZS5leHBvcnRzID0ge1xuICBleHRlbmQ6IGZ1bmN0aW9uKG9iail7IHJldHVybiBVdGlscy5leHRlbmQodGhpcywgb2JqKTsgfSxcblxuICBvbGRDb250YWluZXI6IHVuZGVmaW5lZCxcbiAgbmV3Q29udGFpbmVyOiB1bmRlZmluZWQsXG4gIGNvbnRhaW5lckxvYWRlZDogdW5kZWZpbmVkLFxuICBjb21wbGV0ZWQ6IHVuZGVmaW5lZCxcbiAgLy8vIFJFTkRFUlxuICAvLy8gKiB3aGF0IHNob3VsZCBoYXBwZW4gZHVyaW5nIHRyYW5zaXRpb25cbiAgLy8vICogbXVzdCBjYWxsIHJlc29sdmUoKSBmdW5jdGlvbiBhdCBlbmRcbiAgcmVuZGVyOiBmdW5jdGlvbigpIHt9LFxuXG4gIC8vLyBSRVNPTFZFXG4gIHJlc29sdmU6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMub2xkQ29udGFpbmVyLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5vbGRDb250YWluZXIpO1xuICAgIHRoaXMuY29tcGxldGVkLnJlc29sdmUoKTtcbiAgfSxcblxuICAvLy8gSU5JVFxuICAvLy8gb2xkQ29udGFpbmVyID0gTm9kZVxuICAvLy8gbmV3Q29udGFpbmVyID0gUHJvbWlzZVxuICBpbml0OiBmdW5jdGlvbihvbGRDb250YWluZXIsIHByb21pc2VkQ29udGFpbmVyKSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcbiAgICB2YXIgTG9hZCA9IFV0aWxzLmRlZmVycmVkKCk7XG5cbiAgICB0aGlzLmNvbXBsZXRlZCA9IFV0aWxzLmRlZmVycmVkKCk7XG4gICAgdGhpcy5vbGRDb250YWluZXIgPSBvbGRDb250YWluZXI7XG4gICAgdGhpcy5jb250YWluZXJMb2FkZWQgPSBMb2FkLnByb21pc2U7XG5cbiAgICB0aGlzLnJlbmRlcigpO1xuXG4gICAgcHJvbWlzZWRDb250YWluZXIudGhlbihmdW5jdGlvbihuZXdDb250YWluZXIpIHtcbiAgICAgIF90aGlzLm5ld0NvbnRhaW5lciA9IG5ld0NvbnRhaW5lcjtcbiAgICAgIExvYWQucmVzb2x2ZSgpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXMuY29tcGxldGVkLnByb21pc2U7XG4gIH0sXG5cbn07XG4iLCIvKipcbiAqIEp1c3QgYW4gb2JqZWN0IHdpdGggc29tZSBoZWxwZnVsIGZ1bmN0aW9uc1xuICpcbiAqIEB0eXBlIHtPYmplY3R9XG4gKiBAbmFtZXNwYWNlIEJhcmJhLlV0aWxzXG4gKi9cbnZhciBVdGlscyA9IHtcbiAgLyoqXG4gICAqIFJldHVybiB0aGUgY3VycmVudCB1cmxcbiAgICpcbiAgICogQG1lbWJlck9mIEJhcmJhLlV0aWxzXG4gICAqIEByZXR1cm4ge1N0cmluZ30gY3VycmVudFVybFxuICAgKi9cbiAgZ2V0Q3VycmVudFVybDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCArICcvLycgK1xuICAgICAgICAgICB3aW5kb3cubG9jYXRpb24uaG9zdCArXG4gICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZSArXG4gICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5zZWFyY2g7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEdpdmVuIGFuIHVybCwgcmV0dXJuIGl0IHdpdGhvdXQgdGhlIGhhc2hcbiAgICpcbiAgICogQG1lbWJlck9mIEJhcmJhLlV0aWxzXG4gICAqIEBwYXJhbSAge1N0cmluZ30gdXJsXG4gICAqIEByZXR1cm4ge1N0cmluZ30gbmV3Q2xlYW5VcmxcbiAgICovXG4gIGNsZWFuTGluazogZnVuY3Rpb24odXJsKSB7XG4gICAgcmV0dXJuIHVybC5yZXBsYWNlKC8jLiovLCAnJyk7XG4gIH0sXG5cbiAgLy8vIHdoZXRoZXIgYSBsaW5rIHNob3VsZCBiZSBmb2xsb3dlZFxuICB2YWxpZExpbms6IGZ1bmN0aW9uKGVsZW1lbnQsIGV2ZW50KSB7XG4gICAgaWYgKCFoaXN0b3J5LnB1c2hTdGF0ZSkgcmV0dXJuIGZhbHNlO1xuICAgIC8vLyB1c2VyXG4gICAgaWYgKCFlbGVtZW50IHx8ICFlbGVtZW50LmhyZWYpIHJldHVybiBmYWxzZTtcbiAgICAvLy8gbWlkZGxlIGNsaWNrLCBjbWQgY2xpY2ssIGFuZCBjdHJsIGNsaWNrXG4gICAgaWYgKGV2ZW50LndoaWNoID4gMSB8fCBldmVudC5tZXRhS2V5IHx8IGV2ZW50LmN0cmxLZXkgfHwgZXZlbnQuc2hpZnRLZXkgfHwgZXZlbnQuYWx0S2V5KSByZXR1cm4gZmFsc2U7XG4gICAgLy8vIGlnbm9yZSB0YXJnZXQgd2l0aCBfYmxhbmsgdGFyZ2V0XG4gICAgaWYgKGVsZW1lbnQudGFyZ2V0ICYmIGVsZW1lbnQudGFyZ2V0ID09PSAnX2JsYW5rJykgcmV0dXJuIGZhbHNlO1xuICAgIC8vLyBjaGVjayBpZiBpdCdzIHRoZSBzYW1lIGRvbWFpblxuICAgIGlmICh3aW5kb3cubG9jYXRpb24ucHJvdG9jb2wgIT09IGVsZW1lbnQucHJvdG9jb2wgfHwgd2luZG93LmxvY2F0aW9uLmhvc3RuYW1lICE9PSBlbGVtZW50Lmhvc3RuYW1lKSByZXR1cm4gZmFsc2U7XG4gICAgLy8vIGNoZWNrIGlmIHRoZSBwb3J0IGlzIHRoZSBzYW1lXG4gICAgaWYgKFV0aWxzLmdldFBvcnQoKSAhPT0gVXRpbHMuZ2V0UG9ydChlbGVtZW50LnBvcnQpKSByZXR1cm4gZmFsc2U7XG4gICAgLy8vIGlnbm9yZSBjYXNlIHdoZW4gYSBoYXNoIGlzIGJlaW5nIHRhY2tlZCBvbiB0aGUgY3VycmVudCB1cmxcbiAgICBpZiAoZWxlbWVudC5ocmVmLmluZGV4T2YoJyMnKSA+IC0xKSByZXR1cm4gZmFsc2U7XG4gICAgLy8vIGluIGNhc2UgeW91J3JlIHRyeWluZyB0byBsb2FkIHRoZSBzYW1lIHBhZ2VcbiAgICBpZiAoVXRpbHMuY2xlYW5MaW5rKGVsZW1lbnQuaHJlZikgPT0gVXRpbHMuY2xlYW5MaW5rKGxvY2F0aW9uLmhyZWYpKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGVsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCduby1iYXJiYScpKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFRpbWUgaW4gbWlsbGlzZWNvbmQgYWZ0ZXIgdGhlIHhociByZXF1ZXN0IGdvZXMgaW4gdGltZW91dFxuICAgKlxuICAgKiBAbWVtYmVyT2YgQmFyYmEuVXRpbHNcbiAgICogQHR5cGUge051bWJlcn1cbiAgICogQGRlZmF1bHRcbiAgICovXG4gIHhoclRpbWVvdXQ6IDUwMDAsXG5cbiAgLyoqXG4gICAqIFN0YXJ0IGFuIFhNTEh0dHBSZXF1ZXN0KCkgYW5kIHJldHVybiBhIFByb21pc2VcbiAgICpcbiAgICogQG1lbWJlck9mIEJhcmJhLlV0aWxzXG4gICAqIEBwYXJhbSAge1N0cmluZ30gdXJsXG4gICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAqL1xuICB4aHI6IGZ1bmN0aW9uKHVybCkge1xuICAgIHZhciBkZWZlcnJlZCA9IHRoaXMuZGVmZXJyZWQoKTtcbiAgICB2YXIgcmVxID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICByZXEub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAocmVxLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgaWYgKHJlcS5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5yZXNvbHZlKHJlcS5yZXNwb25zZVRleHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5yZWplY3QobmV3IEVycm9yKCd4aHI6IEhUVFAgY29kZSBpcyBub3QgMjAwJykpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJlcS5vbnRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBkZWZlcnJlZC5yZWplY3QobmV3IEVycm9yKCd4aHI6IFRpbWVvdXQgZXhjZWVkZWQnKSk7XG4gICAgfTtcblxuICAgIHJlcS5vcGVuKCdHRVQnLCB1cmwpO1xuICAgIHJlcS50aW1lb3V0ID0gdGhpcy54aHJUaW1lb3V0O1xuICAgIHJlcS5zZXRSZXF1ZXN0SGVhZGVyKCd4LWJhcmJhJywgJ3llcycpO1xuICAgIHJlcS5zZW5kKCk7XG5cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgfSxcblxuICAvKipcbiAgICogR2V0IG9iaiBhbmQgcHJvcHMgYW5kIHJldHVybiBhIG5ldyBvYmplY3Qgd2l0aCB0aGUgcHJvcGVydHkgbWVyZ2VkXG4gICAqXG4gICAqIEBtZW1iZXJPZiBCYXJiYS5VdGlsc1xuICAgKiBAcGFyYW0gIHtvYmplY3R9IG9ialxuICAgKiBAcGFyYW0gIHtvYmplY3R9IHByb3BzXG4gICAqIEByZXR1cm4ge29iamVjdH1cbiAgICovXG4gIGV4dGVuZDogZnVuY3Rpb24ob2JqLCBwcm9wcykge1xuICAgIHZhciBuZXdPYmogPSBPYmplY3QuY3JlYXRlKG9iaik7XG5cbiAgICBmb3IodmFyIHByb3AgaW4gcHJvcHMpIHtcbiAgICAgIGlmKHByb3BzLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgIG5ld09ialtwcm9wXSA9IHByb3BzW3Byb3BdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBuZXdPYmo7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHVybiBhIG5ldyBcIkRlZmVycmVkXCIgb2JqZWN0XG4gICAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvTW96aWxsYS9KYXZhU2NyaXB0X2NvZGVfbW9kdWxlcy9Qcm9taXNlLmpzbS9EZWZlcnJlZFxuICAgKlxuICAgKiBAcmV0dXJuIHtEZWZlcnJlZH1cbiAgICovXG4gIGRlZmVycmVkOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5yZXNvbHZlID0gbnVsbDtcbiAgICAgIHRoaXMucmVqZWN0ID0gbnVsbDtcblxuICAgICAgdGhpcy5wcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIHRoaXMucmVzb2x2ZSA9IHJlc29sdmU7XG4gICAgICAgIHRoaXMucmVqZWN0ID0gcmVqZWN0O1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9O1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIHBvcnQgbnVtYmVyIG5vcm1hbGl6ZWQsIGV2ZW50dWFsbHkgeW91IGNhbiBwYXNzIGEgc3RyaW5nIHRvIGJlIG5vcm1hbGl6ZWQuXG4gICAqXG4gICAqIEBwYXJhbSAge1N0cmluZ30gcFxuICAgKiBAcmV0dXJuIHtJbnR9IHBvcnRcbiAgICovXG4gIGdldFBvcnQ6IGZ1bmN0aW9uKHApIHtcbiAgICB2YXIgcG9ydCA9IHR5cGVvZiBwICE9PSAndW5kZWZpbmVkJyA/IHAgOiB3aW5kb3cubG9jYXRpb24ucG9ydDtcbiAgICB2YXIgcHJvdG9jb2wgPSB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2w7XG5cbiAgICBpZiAocG9ydCAhPSAnJylcbiAgICAgIHJldHVybiBwYXJzZUludChwb3J0KTtcblxuICAgIGlmIChwcm90b2NvbCA9PT0gJ2h0dHA6JylcbiAgICAgIHJldHVybiA4MDtcblxuICAgIGlmIChwcm90b2NvbCA9PT0gJ2h0dHBzOicpXG4gICAgICByZXR1cm4gNDQzO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFV0aWxzO1xuIiwidmFyIERpc3BhdGNoZXIgPSByZXF1aXJlKCcuLi9kaXNwYXRjaGVyJyk7XG52YXIgVXRpbHMgICAgICA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcblxuLy8vIFZJRVdcbnZhciBWaWV3ID0gbW9kdWxlLmV4cG9ydHMgPSB7XG4gIGV4dGVuZDogZnVuY3Rpb24ob2JqKXsgcmV0dXJuIFV0aWxzLmV4dGVuZCh0aGlzLCBvYmopOyB9LFxuXG4gIG5hbWVzcGFjZTogbnVsbCxcblxuICBuZXdTdGFydDogZnVuY3Rpb24oKSB7fSxcbiAgbmV3Q29tcGxldGU6IGZ1bmN0aW9uKCkge30sXG4gIG9sZFN0YXJ0OiBmdW5jdGlvbigpIHt9LFxuICBvbGRDb21wbGV0ZTogZnVuY3Rpb24oKSB7fSxcblxuICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgRGlzcGF0Y2hlci5vbignc3RhdGVDaGFuZ2UnLFxuICAgICAgZnVuY3Rpb24obmV3U3RhdHVzLCBvbGRTdGF0dXMpIHtcbiAgICAgICAgaWYgKG9sZFN0YXR1cyAmJiBvbGRTdGF0dXMubmFtZXNwYWNlID09PSBfdGhpcy5uYW1lc3BhY2UpXG4gICAgICAgICAgLy8gb2xkQ29udGFpbmVyIHJlYWR5IHRvIHRyYW5zIE9VVFxuICAgICAgICAgIF90aGlzLm9sZFN0YXJ0KCk7XG4gICAgICB9XG4gICAgKTtcblxuICAgIERpc3BhdGNoZXIub24oJ2NvbnRhaW5lckxvYWQnLFxuICAgICAgZnVuY3Rpb24obmV3U3RhdHVzLCBvbGRTdGF0dXMsIGNvbnRhaW5lcikge1xuICAgICAgICBfdGhpcy5jb250YWluZXIgPSBjb250YWluZXI7XG5cbiAgICAgICAgaWYgKG5ld1N0YXR1cy5uYW1lc3BhY2UgPT09IF90aGlzLm5hbWVzcGFjZSlcbiAgICAgICAgICAvLyBuZXdDb250YWluZXIgaXMgcmVhZHkgdG8gdHJhbnMgSU5cbiAgICAgICAgICBfdGhpcy5uZXdTdGFydCgpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBEaXNwYXRjaGVyLm9uKCd0cmFuc2l0aW9uRW5kJyxcbiAgICAgIGZ1bmN0aW9uKG5ld1N0YXR1cywgb2xkU3RhdHVzKSB7XG4gICAgICAgIGlmIChuZXdTdGF0dXMubmFtZXNwYWNlID09PSBfdGhpcy5uYW1lc3BhY2UpXG4gICAgICAgICAgLy8gbmV3Q29udGFpbmVyIHRyYW5zIElOIGlzIGNvbXBsZXRlXG4gICAgICAgICAgX3RoaXMubmV3Q29tcGxldGUoKTtcblxuICAgICAgICBpZiAob2xkU3RhdHVzICYmIG9sZFN0YXR1cy5uYW1lc3BhY2UgPT09IF90aGlzLm5hbWVzcGFjZSlcbiAgICAgICAgICAvLyBvbGRDb250YWluZXIgdHJhbnMgT1VUIGlzIGNvbXBsZXRlXG4gICAgICAgICAgX3RoaXMub2xkQ29tcGxldGUoKTtcbiAgICAgIH1cbiAgICApO1xuICB9XG59XG4iLCJkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgZnVuY3Rpb24oKSB7XG5cbiAgdmFyIGxhc3RFbGVtZW50Q2xpY2tlZDtcbiAgdmFyIFByZXZMaW5rID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignYS5wcmV2Jyk7XG4gIHZhciBOZXh0TGluayA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2EubmV4dCcpO1xuXG4gIHZhciBQamF4ID0gcmVxdWlyZSgnLi4vLi4vc3JjL3BqYXgnKTtcbiAgdmFyIERpc3BhdGNoZXIgPSByZXF1aXJlKCcuLi8uLi9zcmMvZGlzcGF0Y2hlcicpO1xuXG4gIFBqYXguaW5pdCgpO1xuICBQamF4LlByZWZldGNoLmluaXQoKTtcblxuICBEaXNwYXRjaGVyLm9uKCdsaW5rQ2xpY2tlZCcsIGZ1bmN0aW9uKGVsKSB7XG4gICAgbGFzdEVsZW1lbnRDbGlja2VkID0gZWw7XG4gIH0pO1xuXG4gIC8vIGNvbnNvbGUubG9nKFBqYXgpO1xuXG4gIHZhciBNb3ZlUGFnZSA9IFBqYXguVHJhbnNpdGlvbi5leHRlbmQoe1xuICAgIHJlbmRlcigpIHtcbiAgICAgIHRoaXMub3JpZ2luYWxUaHVtYiA9IGxhc3RFbGVtZW50Q2xpY2tlZDtcblxuICAgICAgUHJvbWlzZVxuICAgICAgICAuYWxsKFt0aGlzLmNvbnRhaW5lckxvYWRlZCwgc2Nyb2xsVG9wKCldKVxuICAgICAgICAudGhlbihtb3ZlUGFnZXMuYmluZCh0aGlzKSk7XG4gICAgfVxuICB9KTtcblxuICBQamF4LmRlZmF1bHRUcmFuc2l0aW9uID0gTW92ZVBhZ2U7XG5cbiAgZnVuY3Rpb24gc2Nyb2xsVG9wKCkge1xuICAgIHZhciBkZWZlcnJlZCA9IFBqYXguVXRpbHMuZGVmZXJyZWQoKTtcbiAgICB2YXIgb2JqID0geyB5OiB3aW5kb3cucGFnZVlPZmZzZXQgfTtcblxuICAgIFR3ZWVuTGl0ZS50byhvYmosIDAuNCwge1xuICAgICAgeTogMCxcbiAgICAgIG9uVXBkYXRlKCkge1xuICAgICAgICBpZiAob2JqLnkgPT09IDApIHtcbiAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB3aW5kb3cuc2Nyb2xsKDAsIG9iai55KTtcbiAgICAgIH0sXG4gICAgICBvbkNvbXBsZXRlKCkge1xuICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1vdmVQYWdlcygpIHtcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgIHZhciBnb2luZ0ZvcndhcmQgPSB0cnVlO1xuICAgIFByZXZMaW5rLmhyZWYgPSB0aGlzLm5ld0NvbnRhaW5lci5kYXRhc2V0LnByZXY7XG4gICAgTmV4dExpbmsuaHJlZiA9IHRoaXMubmV3Q29udGFpbmVyLmRhdGFzZXQubmV4dDtcblxuICAgIGlmIChnZXROZXdQYWdlRmlsZSgpID09PSB0aGlzLm9sZENvbnRhaW5lci5kYXRhc2V0LnByZXYpIHtcbiAgICAgIGdvaW5nRm9yd2FyZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIFR3ZWVuTGl0ZS5zZXQodGhpcy5uZXdDb250YWluZXIsIHtcbiAgICAgIHZpc2liaWxpdHk6ICd2aXNpYmxlJyxcbiAgICAgIHhQZXJjZW50OiBnb2luZ0ZvcndhcmQgPyAxMDAgOiAtMTAwLFxuICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICBsZWZ0OiAwLFxuICAgICAgdG9wOiAwLFxuICAgICAgcmlnaHQ6IDBcbiAgICB9KTtcblxuICAgIFR3ZWVuTGl0ZS50byh0aGlzLm9sZENvbnRhaW5lciwgMC42LCB7eFBlcmNlbnQ6IGdvaW5nRm9yd2FyZCA/IC0xMDAgOiAxMDB9KTtcbiAgICBUd2VlbkxpdGUudG8odGhpcy5uZXdDb250YWluZXIsIDAuNiwge3hQZXJjZW50OiAwLCBvbkNvbXBsZXRlKCkge1xuICAgICAgVHdlZW5MaXRlLnNldChfdGhpcy5uZXdDb250YWluZXIsIHtjbGVhclByb3BzOiAnYWxsJyB9KTtcbiAgICAgIF90aGlzLnJlc29sdmUoKTtcbiAgICB9fSk7XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVMaW5rcygpIHtcbiAgICBQcmV2TGluay5ocmVmID0gdGhpcy5uZXdDb250YWluZXIuZGF0YXNldC5wcmV2O1xuICAgIE5leHRMaW5rLmhyZWYgPSB0aGlzLm5ld0NvbnRhaW5lci5kYXRhc2V0Lm5leHQ7XG4gIH1cblxuICBmdW5jdGlvbiBnZXROZXdQYWdlRmlsZSAoKSB7XG4gICAgcmV0dXJuIFBqYXguSGlzdG9yeS5jdXJyU3RhdHVzKCkudXJsLnNwbGl0KCcvJykucG9wKCk7XG4gIH1cblxufSk7XG4iXX0=
