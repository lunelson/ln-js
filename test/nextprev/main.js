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

var Transition = require('./transition');

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

},{"./transition":3}],3:[function(require,module,exports){
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

},{"./utils":4}],4:[function(require,module,exports){
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
   * @return {String} currUrl
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
arguments[4][3][0].apply(exports,arguments)
},{"./utils":12,"dup":3}],12:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92MC4xMi4xNC9saWIvbm9kZV9tb2R1bGVzL2dsb2JpZnkvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvbmF0aXZlLXByb21pc2Utb25seS9saWIvbnBvLnNyYy5qcyIsInNyYy9QamF4L0hpZGVTaG93VHJhbnNpdGlvbi5qcyIsInNyYy9QamF4L3RyYW5zaXRpb24uanMiLCJzcmMvUGpheC91dGlscy5qcyIsInNyYy9kaXNwYXRjaGVyLmpzIiwic3JjL3BqYXguanMiLCJzcmMvcGpheC9jYWNoZS5qcyIsInNyYy9wamF4L2RvbS5qcyIsInNyYy9wamF4L2hpc3RvcnkuanMiLCJzcmMvcGpheC9wcmVmZXRjaC5qcyIsInNyYy9wamF4L3V0aWxzLmpzIiwic3JjL3BqYXgvdmlldy5qcyIsInRlc3QvbmV4dHByZXYvbWFpbi5lcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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QkFBMkI7QUFDOUQsa0JBQVUsR0FBVixDQUFjLE1BQU0sWUFBcEIsRUFBa0MsRUFBQyxZQUFZLEtBQWIsRUFBbEM7QUFDQSxjQUFNLE9BQU47QUFDRDtBQUhvQyxLQUFyQztBQUlEOztBQUVELFdBQVMsV0FBVCxHQUF1QjtBQUNyQixhQUFTLElBQVQsR0FBZ0IsS0FBSyxZQUFMLENBQWtCLE9BQWxCLENBQTBCLElBQTFDO0FBQ0EsYUFBUyxJQUFULEdBQWdCLEtBQUssWUFBTCxDQUFrQixPQUFsQixDQUEwQixJQUExQztBQUNEOztBQUVELFdBQVMsY0FBVCxHQUEyQjtBQUN6QixXQUFPLEtBQUssT0FBTCxDQUFhLFVBQWIsR0FBMEIsR0FBMUIsQ0FBOEIsS0FBOUIsQ0FBb0MsR0FBcEMsRUFBeUMsR0FBekMsRUFBUDtBQUNEO0FBRUYsQ0F0RkQiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyohIE5hdGl2ZSBQcm9taXNlIE9ubHlcbiAgICB2MC44LjEgKGMpIEt5bGUgU2ltcHNvblxuICAgIE1JVCBMaWNlbnNlOiBodHRwOi8vZ2V0aWZ5Lm1pdC1saWNlbnNlLm9yZ1xuKi9cblxuKGZ1bmN0aW9uIFVNRChuYW1lLGNvbnRleHQsZGVmaW5pdGlvbil7XG5cdC8vIHNwZWNpYWwgZm9ybSBvZiBVTUQgZm9yIHBvbHlmaWxsaW5nIGFjcm9zcyBldmlyb25tZW50c1xuXHRjb250ZXh0W25hbWVdID0gY29udGV4dFtuYW1lXSB8fCBkZWZpbml0aW9uKCk7XG5cdGlmICh0eXBlb2YgbW9kdWxlICE9IFwidW5kZWZpbmVkXCIgJiYgbW9kdWxlLmV4cG9ydHMpIHsgbW9kdWxlLmV4cG9ydHMgPSBjb250ZXh0W25hbWVdOyB9XG5cdGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpIHsgZGVmaW5lKGZ1bmN0aW9uICRBTUQkKCl7IHJldHVybiBjb250ZXh0W25hbWVdOyB9KTsgfVxufSkoXCJQcm9taXNlXCIsdHlwZW9mIGdsb2JhbCAhPSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdGhpcyxmdW5jdGlvbiBERUYoKXtcblx0Lypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cblx0XCJ1c2Ugc3RyaWN0XCI7XG5cblx0dmFyIGJ1aWx0SW5Qcm9wLCBjeWNsZSwgc2NoZWR1bGluZ19xdWV1ZSxcblx0XHRUb1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcsXG5cdFx0dGltZXIgPSAodHlwZW9mIHNldEltbWVkaWF0ZSAhPSBcInVuZGVmaW5lZFwiKSA/XG5cdFx0XHRmdW5jdGlvbiB0aW1lcihmbikgeyByZXR1cm4gc2V0SW1tZWRpYXRlKGZuKTsgfSA6XG5cdFx0XHRzZXRUaW1lb3V0XG5cdDtcblxuXHQvLyBkYW1taXQsIElFOC5cblx0dHJ5IHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoe30sXCJ4XCIse30pO1xuXHRcdGJ1aWx0SW5Qcm9wID0gZnVuY3Rpb24gYnVpbHRJblByb3Aob2JqLG5hbWUsdmFsLGNvbmZpZykge1xuXHRcdFx0cmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosbmFtZSx7XG5cdFx0XHRcdHZhbHVlOiB2YWwsXG5cdFx0XHRcdHdyaXRhYmxlOiB0cnVlLFxuXHRcdFx0XHRjb25maWd1cmFibGU6IGNvbmZpZyAhPT0gZmFsc2Vcblx0XHRcdH0pO1xuXHRcdH07XG5cdH1cblx0Y2F0Y2ggKGVycikge1xuXHRcdGJ1aWx0SW5Qcm9wID0gZnVuY3Rpb24gYnVpbHRJblByb3Aob2JqLG5hbWUsdmFsKSB7XG5cdFx0XHRvYmpbbmFtZV0gPSB2YWw7XG5cdFx0XHRyZXR1cm4gb2JqO1xuXHRcdH07XG5cdH1cblxuXHQvLyBOb3RlOiB1c2luZyBhIHF1ZXVlIGluc3RlYWQgb2YgYXJyYXkgZm9yIGVmZmljaWVuY3lcblx0c2NoZWR1bGluZ19xdWV1ZSA9IChmdW5jdGlvbiBRdWV1ZSgpIHtcblx0XHR2YXIgZmlyc3QsIGxhc3QsIGl0ZW07XG5cblx0XHRmdW5jdGlvbiBJdGVtKGZuLHNlbGYpIHtcblx0XHRcdHRoaXMuZm4gPSBmbjtcblx0XHRcdHRoaXMuc2VsZiA9IHNlbGY7XG5cdFx0XHR0aGlzLm5leHQgPSB2b2lkIDA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGFkZDogZnVuY3Rpb24gYWRkKGZuLHNlbGYpIHtcblx0XHRcdFx0aXRlbSA9IG5ldyBJdGVtKGZuLHNlbGYpO1xuXHRcdFx0XHRpZiAobGFzdCkge1xuXHRcdFx0XHRcdGxhc3QubmV4dCA9IGl0ZW07XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0Zmlyc3QgPSBpdGVtO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxhc3QgPSBpdGVtO1xuXHRcdFx0XHRpdGVtID0gdm9pZCAwO1xuXHRcdFx0fSxcblx0XHRcdGRyYWluOiBmdW5jdGlvbiBkcmFpbigpIHtcblx0XHRcdFx0dmFyIGYgPSBmaXJzdDtcblx0XHRcdFx0Zmlyc3QgPSBsYXN0ID0gY3ljbGUgPSB2b2lkIDA7XG5cblx0XHRcdFx0d2hpbGUgKGYpIHtcblx0XHRcdFx0XHRmLmZuLmNhbGwoZi5zZWxmKTtcblx0XHRcdFx0XHRmID0gZi5uZXh0O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fSkoKTtcblxuXHRmdW5jdGlvbiBzY2hlZHVsZShmbixzZWxmKSB7XG5cdFx0c2NoZWR1bGluZ19xdWV1ZS5hZGQoZm4sc2VsZik7XG5cdFx0aWYgKCFjeWNsZSkge1xuXHRcdFx0Y3ljbGUgPSB0aW1lcihzY2hlZHVsaW5nX3F1ZXVlLmRyYWluKTtcblx0XHR9XG5cdH1cblxuXHQvLyBwcm9taXNlIGR1Y2sgdHlwaW5nXG5cdGZ1bmN0aW9uIGlzVGhlbmFibGUobykge1xuXHRcdHZhciBfdGhlbiwgb190eXBlID0gdHlwZW9mIG87XG5cblx0XHRpZiAobyAhPSBudWxsICYmXG5cdFx0XHQoXG5cdFx0XHRcdG9fdHlwZSA9PSBcIm9iamVjdFwiIHx8IG9fdHlwZSA9PSBcImZ1bmN0aW9uXCJcblx0XHRcdClcblx0XHQpIHtcblx0XHRcdF90aGVuID0gby50aGVuO1xuXHRcdH1cblx0XHRyZXR1cm4gdHlwZW9mIF90aGVuID09IFwiZnVuY3Rpb25cIiA/IF90aGVuIDogZmFsc2U7XG5cdH1cblxuXHRmdW5jdGlvbiBub3RpZnkoKSB7XG5cdFx0Zm9yICh2YXIgaT0wOyBpPHRoaXMuY2hhaW4ubGVuZ3RoOyBpKyspIHtcblx0XHRcdG5vdGlmeUlzb2xhdGVkKFxuXHRcdFx0XHR0aGlzLFxuXHRcdFx0XHQodGhpcy5zdGF0ZSA9PT0gMSkgPyB0aGlzLmNoYWluW2ldLnN1Y2Nlc3MgOiB0aGlzLmNoYWluW2ldLmZhaWx1cmUsXG5cdFx0XHRcdHRoaXMuY2hhaW5baV1cblx0XHRcdCk7XG5cdFx0fVxuXHRcdHRoaXMuY2hhaW4ubGVuZ3RoID0gMDtcblx0fVxuXG5cdC8vIE5PVEU6IFRoaXMgaXMgYSBzZXBhcmF0ZSBmdW5jdGlvbiB0byBpc29sYXRlXG5cdC8vIHRoZSBgdHJ5Li5jYXRjaGAgc28gdGhhdCBvdGhlciBjb2RlIGNhbiBiZVxuXHQvLyBvcHRpbWl6ZWQgYmV0dGVyXG5cdGZ1bmN0aW9uIG5vdGlmeUlzb2xhdGVkKHNlbGYsY2IsY2hhaW4pIHtcblx0XHR2YXIgcmV0LCBfdGhlbjtcblx0XHR0cnkge1xuXHRcdFx0aWYgKGNiID09PSBmYWxzZSkge1xuXHRcdFx0XHRjaGFpbi5yZWplY3Qoc2VsZi5tc2cpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGlmIChjYiA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRcdHJldCA9IHNlbGYubXNnO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHJldCA9IGNiLmNhbGwodm9pZCAwLHNlbGYubXNnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChyZXQgPT09IGNoYWluLnByb21pc2UpIHtcblx0XHRcdFx0XHRjaGFpbi5yZWplY3QoVHlwZUVycm9yKFwiUHJvbWlzZS1jaGFpbiBjeWNsZVwiKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSBpZiAoX3RoZW4gPSBpc1RoZW5hYmxlKHJldCkpIHtcblx0XHRcdFx0XHRfdGhlbi5jYWxsKHJldCxjaGFpbi5yZXNvbHZlLGNoYWluLnJlamVjdCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0Y2hhaW4ucmVzb2x2ZShyZXQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNhdGNoIChlcnIpIHtcblx0XHRcdGNoYWluLnJlamVjdChlcnIpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHJlc29sdmUobXNnKSB7XG5cdFx0dmFyIF90aGVuLCBzZWxmID0gdGhpcztcblxuXHRcdC8vIGFscmVhZHkgdHJpZ2dlcmVkP1xuXHRcdGlmIChzZWxmLnRyaWdnZXJlZCkgeyByZXR1cm47IH1cblxuXHRcdHNlbGYudHJpZ2dlcmVkID0gdHJ1ZTtcblxuXHRcdC8vIHVud3JhcFxuXHRcdGlmIChzZWxmLmRlZikge1xuXHRcdFx0c2VsZiA9IHNlbGYuZGVmO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRpZiAoX3RoZW4gPSBpc1RoZW5hYmxlKG1zZykpIHtcblx0XHRcdFx0c2NoZWR1bGUoZnVuY3Rpb24oKXtcblx0XHRcdFx0XHR2YXIgZGVmX3dyYXBwZXIgPSBuZXcgTWFrZURlZldyYXBwZXIoc2VsZik7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdF90aGVuLmNhbGwobXNnLFxuXHRcdFx0XHRcdFx0XHRmdW5jdGlvbiAkcmVzb2x2ZSQoKXsgcmVzb2x2ZS5hcHBseShkZWZfd3JhcHBlcixhcmd1bWVudHMpOyB9LFxuXHRcdFx0XHRcdFx0XHRmdW5jdGlvbiAkcmVqZWN0JCgpeyByZWplY3QuYXBwbHkoZGVmX3dyYXBwZXIsYXJndW1lbnRzKTsgfVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y2F0Y2ggKGVycikge1xuXHRcdFx0XHRcdFx0cmVqZWN0LmNhbGwoZGVmX3dyYXBwZXIsZXJyKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pXG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0c2VsZi5tc2cgPSBtc2c7XG5cdFx0XHRcdHNlbGYuc3RhdGUgPSAxO1xuXHRcdFx0XHRpZiAoc2VsZi5jaGFpbi5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0c2NoZWR1bGUobm90aWZ5LHNlbGYpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNhdGNoIChlcnIpIHtcblx0XHRcdHJlamVjdC5jYWxsKG5ldyBNYWtlRGVmV3JhcHBlcihzZWxmKSxlcnIpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHJlamVjdChtc2cpIHtcblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0XHQvLyBhbHJlYWR5IHRyaWdnZXJlZD9cblx0XHRpZiAoc2VsZi50cmlnZ2VyZWQpIHsgcmV0dXJuOyB9XG5cblx0XHRzZWxmLnRyaWdnZXJlZCA9IHRydWU7XG5cblx0XHQvLyB1bndyYXBcblx0XHRpZiAoc2VsZi5kZWYpIHtcblx0XHRcdHNlbGYgPSBzZWxmLmRlZjtcblx0XHR9XG5cblx0XHRzZWxmLm1zZyA9IG1zZztcblx0XHRzZWxmLnN0YXRlID0gMjtcblx0XHRpZiAoc2VsZi5jaGFpbi5sZW5ndGggPiAwKSB7XG5cdFx0XHRzY2hlZHVsZShub3RpZnksc2VsZik7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gaXRlcmF0ZVByb21pc2VzKENvbnN0cnVjdG9yLGFycixyZXNvbHZlcixyZWplY3Rlcikge1xuXHRcdGZvciAodmFyIGlkeD0wOyBpZHg8YXJyLmxlbmd0aDsgaWR4KyspIHtcblx0XHRcdChmdW5jdGlvbiBJSUZFKGlkeCl7XG5cdFx0XHRcdENvbnN0cnVjdG9yLnJlc29sdmUoYXJyW2lkeF0pXG5cdFx0XHRcdC50aGVuKFxuXHRcdFx0XHRcdGZ1bmN0aW9uICRyZXNvbHZlciQobXNnKXtcblx0XHRcdFx0XHRcdHJlc29sdmVyKGlkeCxtc2cpO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0cmVqZWN0ZXJcblx0XHRcdFx0KTtcblx0XHRcdH0pKGlkeCk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gTWFrZURlZldyYXBwZXIoc2VsZikge1xuXHRcdHRoaXMuZGVmID0gc2VsZjtcblx0XHR0aGlzLnRyaWdnZXJlZCA9IGZhbHNlO1xuXHR9XG5cblx0ZnVuY3Rpb24gTWFrZURlZihzZWxmKSB7XG5cdFx0dGhpcy5wcm9taXNlID0gc2VsZjtcblx0XHR0aGlzLnN0YXRlID0gMDtcblx0XHR0aGlzLnRyaWdnZXJlZCA9IGZhbHNlO1xuXHRcdHRoaXMuY2hhaW4gPSBbXTtcblx0XHR0aGlzLm1zZyA9IHZvaWQgMDtcblx0fVxuXG5cdGZ1bmN0aW9uIFByb21pc2UoZXhlY3V0b3IpIHtcblx0XHRpZiAodHlwZW9mIGV4ZWN1dG9yICE9IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0dGhyb3cgVHlwZUVycm9yKFwiTm90IGEgZnVuY3Rpb25cIik7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX19OUE9fXyAhPT0gMCkge1xuXHRcdFx0dGhyb3cgVHlwZUVycm9yKFwiTm90IGEgcHJvbWlzZVwiKTtcblx0XHR9XG5cblx0XHQvLyBpbnN0YW5jZSBzaGFkb3dpbmcgdGhlIGluaGVyaXRlZCBcImJyYW5kXCJcblx0XHQvLyB0byBzaWduYWwgYW4gYWxyZWFkeSBcImluaXRpYWxpemVkXCIgcHJvbWlzZVxuXHRcdHRoaXMuX19OUE9fXyA9IDE7XG5cblx0XHR2YXIgZGVmID0gbmV3IE1ha2VEZWYodGhpcyk7XG5cblx0XHR0aGlzW1widGhlblwiXSA9IGZ1bmN0aW9uIHRoZW4oc3VjY2VzcyxmYWlsdXJlKSB7XG5cdFx0XHR2YXIgbyA9IHtcblx0XHRcdFx0c3VjY2VzczogdHlwZW9mIHN1Y2Nlc3MgPT0gXCJmdW5jdGlvblwiID8gc3VjY2VzcyA6IHRydWUsXG5cdFx0XHRcdGZhaWx1cmU6IHR5cGVvZiBmYWlsdXJlID09IFwiZnVuY3Rpb25cIiA/IGZhaWx1cmUgOiBmYWxzZVxuXHRcdFx0fTtcblx0XHRcdC8vIE5vdGU6IGB0aGVuKC4uKWAgaXRzZWxmIGNhbiBiZSBib3Jyb3dlZCB0byBiZSB1c2VkIGFnYWluc3Rcblx0XHRcdC8vIGEgZGlmZmVyZW50IHByb21pc2UgY29uc3RydWN0b3IgZm9yIG1ha2luZyB0aGUgY2hhaW5lZCBwcm9taXNlLFxuXHRcdFx0Ly8gYnkgc3Vic3RpdHV0aW5nIGEgZGlmZmVyZW50IGB0aGlzYCBiaW5kaW5nLlxuXHRcdFx0by5wcm9taXNlID0gbmV3IHRoaXMuY29uc3RydWN0b3IoZnVuY3Rpb24gZXh0cmFjdENoYWluKHJlc29sdmUscmVqZWN0KSB7XG5cdFx0XHRcdGlmICh0eXBlb2YgcmVzb2x2ZSAhPSBcImZ1bmN0aW9uXCIgfHwgdHlwZW9mIHJlamVjdCAhPSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdFx0XHR0aHJvdyBUeXBlRXJyb3IoXCJOb3QgYSBmdW5jdGlvblwiKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdG8ucmVzb2x2ZSA9IHJlc29sdmU7XG5cdFx0XHRcdG8ucmVqZWN0ID0gcmVqZWN0O1xuXHRcdFx0fSk7XG5cdFx0XHRkZWYuY2hhaW4ucHVzaChvKTtcblxuXHRcdFx0aWYgKGRlZi5zdGF0ZSAhPT0gMCkge1xuXHRcdFx0XHRzY2hlZHVsZShub3RpZnksZGVmKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG8ucHJvbWlzZTtcblx0XHR9O1xuXHRcdHRoaXNbXCJjYXRjaFwiXSA9IGZ1bmN0aW9uICRjYXRjaCQoZmFpbHVyZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMudGhlbih2b2lkIDAsZmFpbHVyZSk7XG5cdFx0fTtcblxuXHRcdHRyeSB7XG5cdFx0XHRleGVjdXRvci5jYWxsKFxuXHRcdFx0XHR2b2lkIDAsXG5cdFx0XHRcdGZ1bmN0aW9uIHB1YmxpY1Jlc29sdmUobXNnKXtcblx0XHRcdFx0XHRyZXNvbHZlLmNhbGwoZGVmLG1zZyk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGZ1bmN0aW9uIHB1YmxpY1JlamVjdChtc2cpIHtcblx0XHRcdFx0XHRyZWplY3QuY2FsbChkZWYsbXNnKTtcblx0XHRcdFx0fVxuXHRcdFx0KTtcblx0XHR9XG5cdFx0Y2F0Y2ggKGVycikge1xuXHRcdFx0cmVqZWN0LmNhbGwoZGVmLGVycik7XG5cdFx0fVxuXHR9XG5cblx0dmFyIFByb21pc2VQcm90b3R5cGUgPSBidWlsdEluUHJvcCh7fSxcImNvbnN0cnVjdG9yXCIsUHJvbWlzZSxcblx0XHQvKmNvbmZpZ3VyYWJsZT0qL2ZhbHNlXG5cdCk7XG5cblx0Ly8gTm90ZTogQW5kcm9pZCA0IGNhbm5vdCB1c2UgYE9iamVjdC5kZWZpbmVQcm9wZXJ0eSguLilgIGhlcmVcblx0UHJvbWlzZS5wcm90b3R5cGUgPSBQcm9taXNlUHJvdG90eXBlO1xuXG5cdC8vIGJ1aWx0LWluIFwiYnJhbmRcIiB0byBzaWduYWwgYW4gXCJ1bmluaXRpYWxpemVkXCIgcHJvbWlzZVxuXHRidWlsdEluUHJvcChQcm9taXNlUHJvdG90eXBlLFwiX19OUE9fX1wiLDAsXG5cdFx0Lypjb25maWd1cmFibGU9Ki9mYWxzZVxuXHQpO1xuXG5cdGJ1aWx0SW5Qcm9wKFByb21pc2UsXCJyZXNvbHZlXCIsZnVuY3Rpb24gUHJvbWlzZSRyZXNvbHZlKG1zZykge1xuXHRcdHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cblx0XHQvLyBzcGVjIG1hbmRhdGVkIGNoZWNrc1xuXHRcdC8vIG5vdGU6IGJlc3QgXCJpc1Byb21pc2VcIiBjaGVjayB0aGF0J3MgcHJhY3RpY2FsIGZvciBub3dcblx0XHRpZiAobXNnICYmIHR5cGVvZiBtc2cgPT0gXCJvYmplY3RcIiAmJiBtc2cuX19OUE9fXyA9PT0gMSkge1xuXHRcdFx0cmV0dXJuIG1zZztcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IENvbnN0cnVjdG9yKGZ1bmN0aW9uIGV4ZWN1dG9yKHJlc29sdmUscmVqZWN0KXtcblx0XHRcdGlmICh0eXBlb2YgcmVzb2x2ZSAhPSBcImZ1bmN0aW9uXCIgfHwgdHlwZW9mIHJlamVjdCAhPSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdFx0dGhyb3cgVHlwZUVycm9yKFwiTm90IGEgZnVuY3Rpb25cIik7XG5cdFx0XHR9XG5cblx0XHRcdHJlc29sdmUobXNnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0YnVpbHRJblByb3AoUHJvbWlzZSxcInJlamVjdFwiLGZ1bmN0aW9uIFByb21pc2UkcmVqZWN0KG1zZykge1xuXHRcdHJldHVybiBuZXcgdGhpcyhmdW5jdGlvbiBleGVjdXRvcihyZXNvbHZlLHJlamVjdCl7XG5cdFx0XHRpZiAodHlwZW9mIHJlc29sdmUgIT0gXCJmdW5jdGlvblwiIHx8IHR5cGVvZiByZWplY3QgIT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdHRocm93IFR5cGVFcnJvcihcIk5vdCBhIGZ1bmN0aW9uXCIpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZWplY3QobXNnKTtcblx0XHR9KTtcblx0fSk7XG5cblx0YnVpbHRJblByb3AoUHJvbWlzZSxcImFsbFwiLGZ1bmN0aW9uIFByb21pc2UkYWxsKGFycikge1xuXHRcdHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cblx0XHQvLyBzcGVjIG1hbmRhdGVkIGNoZWNrc1xuXHRcdGlmIChUb1N0cmluZy5jYWxsKGFycikgIT0gXCJbb2JqZWN0IEFycmF5XVwiKSB7XG5cdFx0XHRyZXR1cm4gQ29uc3RydWN0b3IucmVqZWN0KFR5cGVFcnJvcihcIk5vdCBhbiBhcnJheVwiKSk7XG5cdFx0fVxuXHRcdGlmIChhcnIubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gQ29uc3RydWN0b3IucmVzb2x2ZShbXSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBDb25zdHJ1Y3RvcihmdW5jdGlvbiBleGVjdXRvcihyZXNvbHZlLHJlamVjdCl7XG5cdFx0XHRpZiAodHlwZW9mIHJlc29sdmUgIT0gXCJmdW5jdGlvblwiIHx8IHR5cGVvZiByZWplY3QgIT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdHRocm93IFR5cGVFcnJvcihcIk5vdCBhIGZ1bmN0aW9uXCIpO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgbGVuID0gYXJyLmxlbmd0aCwgbXNncyA9IEFycmF5KGxlbiksIGNvdW50ID0gMDtcblxuXHRcdFx0aXRlcmF0ZVByb21pc2VzKENvbnN0cnVjdG9yLGFycixmdW5jdGlvbiByZXNvbHZlcihpZHgsbXNnKSB7XG5cdFx0XHRcdG1zZ3NbaWR4XSA9IG1zZztcblx0XHRcdFx0aWYgKCsrY291bnQgPT09IGxlbikge1xuXHRcdFx0XHRcdHJlc29sdmUobXNncyk7XG5cdFx0XHRcdH1cblx0XHRcdH0scmVqZWN0KTtcblx0XHR9KTtcblx0fSk7XG5cblx0YnVpbHRJblByb3AoUHJvbWlzZSxcInJhY2VcIixmdW5jdGlvbiBQcm9taXNlJHJhY2UoYXJyKSB7XG5cdFx0dmFyIENvbnN0cnVjdG9yID0gdGhpcztcblxuXHRcdC8vIHNwZWMgbWFuZGF0ZWQgY2hlY2tzXG5cdFx0aWYgKFRvU3RyaW5nLmNhbGwoYXJyKSAhPSBcIltvYmplY3QgQXJyYXldXCIpIHtcblx0XHRcdHJldHVybiBDb25zdHJ1Y3Rvci5yZWplY3QoVHlwZUVycm9yKFwiTm90IGFuIGFycmF5XCIpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IENvbnN0cnVjdG9yKGZ1bmN0aW9uIGV4ZWN1dG9yKHJlc29sdmUscmVqZWN0KXtcblx0XHRcdGlmICh0eXBlb2YgcmVzb2x2ZSAhPSBcImZ1bmN0aW9uXCIgfHwgdHlwZW9mIHJlamVjdCAhPSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdFx0dGhyb3cgVHlwZUVycm9yKFwiTm90IGEgZnVuY3Rpb25cIik7XG5cdFx0XHR9XG5cblx0XHRcdGl0ZXJhdGVQcm9taXNlcyhDb25zdHJ1Y3RvcixhcnIsZnVuY3Rpb24gcmVzb2x2ZXIoaWR4LG1zZyl7XG5cdFx0XHRcdHJlc29sdmUobXNnKTtcblx0XHRcdH0scmVqZWN0KTtcblx0XHR9KTtcblx0fSk7XG5cblx0cmV0dXJuIFByb21pc2U7XG59KTtcbiIsInZhciBUcmFuc2l0aW9uID0gcmVxdWlyZSgnLi90cmFuc2l0aW9uJyk7XG5cbnZhciBIaWRlU2hvd1RyYW5zaXRpb24gPSBtb2R1bGUuZXhwb3J0cyA9IFRyYW5zaXRpb24uZXh0ZW5kKHtcbiAgc3RhcnQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMubmV3Q29udGFpbmVyUHJvbWlzZS50aGVuKHRoaXMuaGlkZVNob3cuYmluZCh0aGlzKSk7XG4gIH0sXG5cbiAgaGlkZVNob3c6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMub2xkQ29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICB0aGlzLm5ld0NvbnRhaW5lci5zdHlsZS52aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICAgIGRvY3VtZW50LmJvZHkuc2Nyb2xsVG9wID0gMDtcblxuICAgIHRoaXMuZG9uZSgpO1xuICB9XG59KTtcbiIsInZhciBVdGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcblxuLy8vIFRSQU5TSVRJT05cbnZhciBUcmFuc2l0aW9uID0gbW9kdWxlLmV4cG9ydHMgPSB7XG4gIGV4dGVuZDogZnVuY3Rpb24ob2JqKXsgcmV0dXJuIFV0aWxzLmV4dGVuZCh0aGlzLCBvYmopOyB9LFxuXG4gIG9sZENvbnRhaW5lcjogdW5kZWZpbmVkLFxuICBuZXdDb250YWluZXI6IHVuZGVmaW5lZCxcbiAgY29udGFpbmVyTG9hZGVkOiB1bmRlZmluZWQsXG4gIGNvbXBsZXRlZDogdW5kZWZpbmVkLFxuICAvLy8gUkVOREVSXG4gIC8vLyAqIHdoYXQgc2hvdWxkIGhhcHBlbiBkdXJpbmcgdHJhbnNpdGlvblxuICAvLy8gKiBtdXN0IGNhbGwgcmVzb2x2ZSgpIGZ1bmN0aW9uIGF0IGVuZFxuICByZW5kZXI6IGZ1bmN0aW9uKCkge30sXG5cbiAgLy8vIFJFU09MVkVcbiAgcmVzb2x2ZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5vbGRDb250YWluZXIucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLm9sZENvbnRhaW5lcik7XG4gICAgdGhpcy5jb21wbGV0ZWQucmVzb2x2ZSgpO1xuICB9LFxuXG4gIC8vLyBJTklUXG4gIC8vLyBvbGRDb250YWluZXIgPSBOb2RlXG4gIC8vLyBuZXdDb250YWluZXIgPSBQcm9taXNlXG4gIGluaXQ6IGZ1bmN0aW9uKG9sZENvbnRhaW5lciwgcHJvbWlzZWRDb250YWluZXIpIHtcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgIHZhciBMb2FkID0gVXRpbHMuZGVmZXJyZWQoKTtcblxuICAgIHRoaXMuY29tcGxldGVkID0gVXRpbHMuZGVmZXJyZWQoKTtcbiAgICB0aGlzLm9sZENvbnRhaW5lciA9IG9sZENvbnRhaW5lcjtcbiAgICB0aGlzLmNvbnRhaW5lckxvYWRlZCA9IExvYWQucHJvbWlzZTtcblxuICAgIHRoaXMucmVuZGVyKCk7XG5cbiAgICBwcm9taXNlZENvbnRhaW5lci50aGVuKGZ1bmN0aW9uKG5ld0NvbnRhaW5lcikge1xuICAgICAgX3RoaXMubmV3Q29udGFpbmVyID0gbmV3Q29udGFpbmVyO1xuICAgICAgTG9hZC5yZXNvbHZlKCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcy5jb21wbGV0ZWQucHJvbWlzZTtcbiAgfSxcblxufTtcbiIsIi8qKlxuICogSnVzdCBhbiBvYmplY3Qgd2l0aCBzb21lIGhlbHBmdWwgZnVuY3Rpb25zXG4gKlxuICogQHR5cGUge09iamVjdH1cbiAqIEBuYW1lc3BhY2UgQmFyYmEuVXRpbHNcbiAqL1xudmFyIFV0aWxzID0ge1xuICAvKipcbiAgICogUmV0dXJuIHRoZSBjdXJyZW50IHVybFxuICAgKlxuICAgKiBAbWVtYmVyT2YgQmFyYmEuVXRpbHNcbiAgICogQHJldHVybiB7U3RyaW5nfSBjdXJyVXJsXG4gICAqL1xuICBnZXRDdXJyZW50VXJsOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gd2luZG93LmxvY2F0aW9uLnByb3RvY29sICsgJy8vJyArXG4gICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5ob3N0ICtcbiAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lICtcbiAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLnNlYXJjaDtcbiAgfSxcblxuICAvKipcbiAgICogR2l2ZW4gYW4gdXJsLCByZXR1cm4gaXQgd2l0aG91dCB0aGUgaGFzaFxuICAgKlxuICAgKiBAbWVtYmVyT2YgQmFyYmEuVXRpbHNcbiAgICogQHBhcmFtICB7U3RyaW5nfSB1cmxcbiAgICogQHJldHVybiB7U3RyaW5nfSBuZXdDbGVhblVybFxuICAgKi9cbiAgY2xlYW5MaW5rOiBmdW5jdGlvbih1cmwpIHtcbiAgICByZXR1cm4gdXJsLnJlcGxhY2UoLyMuKi8sICcnKTtcbiAgfSxcblxuICAvLy8gd2hldGhlciBhIGxpbmsgc2hvdWxkIGJlIGZvbGxvd2VkXG4gIHZhbGlkTGluazogZnVuY3Rpb24oZWxlbWVudCwgZXZlbnQpIHtcbiAgICBpZiAoIWhpc3RvcnkucHVzaFN0YXRlKSByZXR1cm4gZmFsc2U7XG4gICAgLy8vIHVzZXJcbiAgICBpZiAoIWVsZW1lbnQgfHwgIWVsZW1lbnQuaHJlZikgcmV0dXJuIGZhbHNlO1xuICAgIC8vLyBtaWRkbGUgY2xpY2ssIGNtZCBjbGljaywgYW5kIGN0cmwgY2xpY2tcbiAgICBpZiAoZXZlbnQud2hpY2ggPiAxIHx8IGV2ZW50Lm1ldGFLZXkgfHwgZXZlbnQuY3RybEtleSB8fCBldmVudC5zaGlmdEtleSB8fCBldmVudC5hbHRLZXkpIHJldHVybiBmYWxzZTtcbiAgICAvLy8gaWdub3JlIHRhcmdldCB3aXRoIF9ibGFuayB0YXJnZXRcbiAgICBpZiAoZWxlbWVudC50YXJnZXQgJiYgZWxlbWVudC50YXJnZXQgPT09ICdfYmxhbmsnKSByZXR1cm4gZmFsc2U7XG4gICAgLy8vIGNoZWNrIGlmIGl0J3MgdGhlIHNhbWUgZG9tYWluXG4gICAgaWYgKHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbCAhPT0gZWxlbWVudC5wcm90b2NvbCB8fCB3aW5kb3cubG9jYXRpb24uaG9zdG5hbWUgIT09IGVsZW1lbnQuaG9zdG5hbWUpIHJldHVybiBmYWxzZTtcbiAgICAvLy8gY2hlY2sgaWYgdGhlIHBvcnQgaXMgdGhlIHNhbWVcbiAgICBpZiAoVXRpbHMuZ2V0UG9ydCgpICE9PSBVdGlscy5nZXRQb3J0KGVsZW1lbnQucG9ydCkpIHJldHVybiBmYWxzZTtcbiAgICAvLy8gaWdub3JlIGNhc2Ugd2hlbiBhIGhhc2ggaXMgYmVpbmcgdGFja2VkIG9uIHRoZSBjdXJyZW50IHVybFxuICAgIGlmIChlbGVtZW50LmhyZWYuaW5kZXhPZignIycpID4gLTEpIHJldHVybiBmYWxzZTtcbiAgICAvLy8gaW4gY2FzZSB5b3UncmUgdHJ5aW5nIHRvIGxvYWQgdGhlIHNhbWUgcGFnZVxuICAgIGlmIChVdGlscy5jbGVhbkxpbmsoZWxlbWVudC5ocmVmKSA9PSBVdGlscy5jbGVhbkxpbmsobG9jYXRpb24uaHJlZikpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoJ25vLWJhcmJhJykpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcblxuICAvKipcbiAgICogVGltZSBpbiBtaWxsaXNlY29uZCBhZnRlciB0aGUgeGhyIHJlcXVlc3QgZ29lcyBpbiB0aW1lb3V0XG4gICAqXG4gICAqIEBtZW1iZXJPZiBCYXJiYS5VdGlsc1xuICAgKiBAdHlwZSB7TnVtYmVyfVxuICAgKiBAZGVmYXVsdFxuICAgKi9cbiAgeGhyVGltZW91dDogNTAwMCxcblxuICAvKipcbiAgICogU3RhcnQgYW4gWE1MSHR0cFJlcXVlc3QoKSBhbmQgcmV0dXJuIGEgUHJvbWlzZVxuICAgKlxuICAgKiBAbWVtYmVyT2YgQmFyYmEuVXRpbHNcbiAgICogQHBhcmFtICB7U3RyaW5nfSB1cmxcbiAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICovXG4gIHhocjogZnVuY3Rpb24odXJsKSB7XG4gICAgdmFyIGRlZmVycmVkID0gdGhpcy5kZWZlcnJlZCgpO1xuICAgIHZhciByZXEgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgIHJlcS5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChyZXEucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICBpZiAocmVxLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgcmV0dXJuIGRlZmVycmVkLnJlc29sdmUocmVxLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGRlZmVycmVkLnJlamVjdChuZXcgRXJyb3IoJ3hocjogSFRUUCBjb2RlIGlzIG5vdCAyMDAnKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmVxLm9udGltZW91dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGRlZmVycmVkLnJlamVjdChuZXcgRXJyb3IoJ3hocjogVGltZW91dCBleGNlZWRlZCcpKTtcbiAgICB9O1xuXG4gICAgcmVxLm9wZW4oJ0dFVCcsIHVybCk7XG4gICAgcmVxLnRpbWVvdXQgPSB0aGlzLnhoclRpbWVvdXQ7XG4gICAgcmVxLnNldFJlcXVlc3RIZWFkZXIoJ3gtYmFyYmEnLCAneWVzJyk7XG4gICAgcmVxLnNlbmQoKTtcblxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHZXQgb2JqIGFuZCBwcm9wcyBhbmQgcmV0dXJuIGEgbmV3IG9iamVjdCB3aXRoIHRoZSBwcm9wZXJ0eSBtZXJnZWRcbiAgICpcbiAgICogQG1lbWJlck9mIEJhcmJhLlV0aWxzXG4gICAqIEBwYXJhbSAge29iamVjdH0gb2JqXG4gICAqIEBwYXJhbSAge29iamVjdH0gcHJvcHNcbiAgICogQHJldHVybiB7b2JqZWN0fVxuICAgKi9cbiAgZXh0ZW5kOiBmdW5jdGlvbihvYmosIHByb3BzKSB7XG4gICAgdmFyIG5ld09iaiA9IE9iamVjdC5jcmVhdGUob2JqKTtcblxuICAgIGZvcih2YXIgcHJvcCBpbiBwcm9wcykge1xuICAgICAgaWYocHJvcHMuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgbmV3T2JqW3Byb3BdID0gcHJvcHNbcHJvcF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld09iajtcbiAgfSxcblxuICAvKipcbiAgICogUmV0dXJuIGEgbmV3IFwiRGVmZXJyZWRcIiBvYmplY3RcbiAgICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9Nb3ppbGxhL0phdmFTY3JpcHRfY29kZV9tb2R1bGVzL1Byb21pc2UuanNtL0RlZmVycmVkXG4gICAqXG4gICAqIEByZXR1cm4ge0RlZmVycmVkfVxuICAgKi9cbiAgZGVmZXJyZWQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLnJlc29sdmUgPSBudWxsO1xuICAgICAgdGhpcy5yZWplY3QgPSBudWxsO1xuXG4gICAgICB0aGlzLnByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgdGhpcy5yZXNvbHZlID0gcmVzb2x2ZTtcbiAgICAgICAgdGhpcy5yZWplY3QgPSByZWplY3Q7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH07XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgcG9ydCBudW1iZXIgbm9ybWFsaXplZCwgZXZlbnR1YWxseSB5b3UgY2FuIHBhc3MgYSBzdHJpbmcgdG8gYmUgbm9ybWFsaXplZC5cbiAgICpcbiAgICogQHBhcmFtICB7U3RyaW5nfSBwXG4gICAqIEByZXR1cm4ge0ludH0gcG9ydFxuICAgKi9cbiAgZ2V0UG9ydDogZnVuY3Rpb24ocCkge1xuICAgIHZhciBwb3J0ID0gdHlwZW9mIHAgIT09ICd1bmRlZmluZWQnID8gcCA6IHdpbmRvdy5sb2NhdGlvbi5wb3J0O1xuICAgIHZhciBwcm90b2NvbCA9IHdpbmRvdy5sb2NhdGlvbi5wcm90b2NvbDtcblxuICAgIGlmIChwb3J0ICE9ICcnKVxuICAgICAgcmV0dXJuIHBhcnNlSW50KHBvcnQpO1xuXG4gICAgaWYgKHByb3RvY29sID09PSAnaHR0cDonKVxuICAgICAgcmV0dXJuIDgwO1xuXG4gICAgaWYgKHByb3RvY29sID09PSAnaHR0cHM6JylcbiAgICAgIHJldHVybiA0NDM7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVXRpbHM7XG4iLCIvKipcbiAqIExpdHRsZSBEaXNwYXRjaGVyIGluc3BpcmVkIGJ5IE1pY3JvRXZlbnQuanNcbiAqXG4gKiBAbmFtZXNwYWNlIEJhcmJhLkRpc3BhdGNoZXJcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cbnZhciBEaXNwYXRjaGVyID0ge1xuICAvKipcbiAgICogRXZlbnQgYXJyYXlcbiAgICpcbiAgICogQG1lbWJlck9mIEJhcmJhLkRpc3BhdGNoZXJcbiAgICogQHJlYWRPbmx5XG4gICAqIEB0eXBlIHtPYmplY3R9XG4gICAqL1xuICBldmVudHM6IHt9LFxuXG4gIC8qKlxuICAgKiBCaW5kIGEgY2FsbGJhY2sgdG8gYW4gZXZlbnRcbiAgICpcbiAgICogQG1lbWJlck9mIEJhcmJhLkRpc3BhdGNoZXJcbiAgICogQHBhcmFtICB7U3RyaW5nfSBldmVudE5hbWVcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGZ1bmN0aW9uXG4gICAqL1xuICBvbihlLCBmKSB7XG4gICAgdGhpcy5ldmVudHNbZV0gPSB0aGlzLmV2ZW50c1tlXSB8fCBbXTtcbiAgICB0aGlzLmV2ZW50c1tlXS5wdXNoKGYpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBVbmJpbmQgZXZlbnRcbiAgICpcbiAgICogQG1lbWJlck9mIEJhcmJhLkRpc3BhdGNoZXJcbiAgICogQHBhcmFtICB7U3RyaW5nfSBldmVudE5hbWVcbiAgICogQHBhcmFtICB7RnVuY3Rpb259IGZ1bmN0aW9uXG4gICAqL1xuICBvZmYoZSwgZikge1xuICAgIGlmKGUgaW4gdGhpcy5ldmVudHMgPT09IGZhbHNlKVxuICAgICAgcmV0dXJuO1xuXG4gICAgdGhpcy5ldmVudHNbZV0uc3BsaWNlKHRoaXMuZXZlbnRzW2VdLmluZGV4T2YoZiksIDEpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBGaXJlIHRoZSBldmVudCBydW5uaW5nIGFsbCB0aGUgZXZlbnQgYXNzb2NpYXRlZFxuICAgKlxuICAgKiBAbWVtYmVyT2YgQmFyYmEuRGlzcGF0Y2hlclxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IGV2ZW50TmFtZVxuICAgKiBAcGFyYW0gey4uLip9IGFyZ3NcbiAgICovXG4gIHRyaWdnZXIoZSkgey8vZSwgLi4uYXJnc1xuICAgIGlmIChlIGluIHRoaXMuZXZlbnRzID09PSBmYWxzZSlcbiAgICAgIHJldHVybjtcblxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCB0aGlzLmV2ZW50c1tlXS5sZW5ndGg7IGkrKyl7XG4gICAgICB0aGlzLmV2ZW50c1tlXVtpXS5hcHBseSh0aGlzLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICB9XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRGlzcGF0Y2hlcjtcbiIsIi8vLyBQcm9taXNlIHBvbHlmaWxsIGh0dHBzOi8vZ2l0aHViLmNvbS90YXlsb3JoYWtlcy9wcm9taXNlLXBvbHlmaWxsXG4vLy8gYWx0ZXJuYXRpdmUgLS0gaHR0cHM6Ly9naXRodWIuY29tL2dldGlmeS9uYXRpdmUtcHJvbWlzZS1vbmx5XG5pZiAodHlwZW9mIFByb21pc2UgIT09ICdmdW5jdGlvbicpIHsgd2luZG93LlByb21pc2UgPSByZXF1aXJlKCduYXRpdmUtcHJvbWlzZS1vbmx5Jyk7IH1cblxuLy8gZ2VuZXJhbFxudmFyIERpc3BhdGNoZXIgICAgICAgID0gcmVxdWlyZSgnLi9kaXNwYXRjaGVyJyk7XG5cbi8vIHBqYXggc3BlY2lmaWMgc3R1ZmZcbnZhciBDYWNoZSAgICAgID0gcmVxdWlyZSgnLi9wamF4L2NhY2hlJyk7XG52YXIgRG9tICAgICAgICA9IHJlcXVpcmUoJy4vcGpheC9kb20nKTtcbnZhciBIaXN0b3J5ICAgID0gcmVxdWlyZSgnLi9wamF4L2hpc3RvcnknKTtcbnZhciBQcmVmZXRjaCAgID0gcmVxdWlyZSgnLi9wamF4L3ByZWZldGNoJyk7XG52YXIgVHJhbnNpdGlvbiA9IHJlcXVpcmUoJy4vcGpheC90cmFuc2l0aW9uJyk7XG52YXIgVmlldyAgICAgICA9IHJlcXVpcmUoJy4vcGpheC92aWV3Jyk7XG52YXIgVXRpbHMgICAgICA9IHJlcXVpcmUoJy4vcGpheC91dGlscycpO1xuXG5cbi8vLyBnZXQgY3VycmVudCBVUkxcbmZ1bmN0aW9uIGdldEN1cnJlbnRVcmwoKSB7IHJldHVybiBVdGlscy5jbGVhbkxpbmsoIFV0aWxzLmdldEN1cnJlbnRVcmwoKSApOyB9XG5cbi8vIFRPRE86IHJlbmFtZSB0aGUgZm9sbG93aW5nIHR3byBmdW5jdGlvbnNcbi8vLyBnbyB0b1xuLy8gZnVuY3Rpb24gZ29Ubyh1cmwpIHtcbi8vICAgd2luZG93Lmhpc3RvcnkucHVzaFN0YXRlKG51bGwsIG51bGwsIHVybCk7XG4vLyAgIG9uU3RhdGVDaGFuZ2UoKTtcbi8vIH1cbi8vLyBmb3JjZSBnbyB0b1xuZnVuY3Rpb24gZm9yY2VHb1RvKHVybCkgeyB3aW5kb3cubG9jYXRpb24gPSB1cmw7IH1cblxuLy8vIGxpbmtDbGljayBoYW5kbGVyXG5mdW5jdGlvbiBvbkxpbmtDbGljayhldmVudCkge1xuICAvLyByZXNvbHZlIHRoZSBlbGVtZW50XG4gIHZhciBlbGVtZW50ID0gZXZlbnQudGFyZ2V0O1xuICB3aGlsZSAoZWxlbWVudCAmJiAhZWxlbWVudC5ocmVmKSB7IGVsZW1lbnQgPSBlbGVtZW50LnBhcmVudE5vZGU7IH1cbiAgLy8gY2hlY2sgaWYgZWxlbWVudCBpcyB2YWxpZFxuICBpZiAoVXRpbHMudmFsaWRMaW5rKGVsZW1lbnQsIGV2ZW50KSkge1xuICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgLy8gZmlyZSBhbmQgdXBkYXRlXG4gICAgRGlzcGF0Y2hlci50cmlnZ2VyKCdsaW5rQ2xpY2snLCBlbGVtZW50KTtcbiAgICB3aW5kb3cuaGlzdG9yeS5wdXNoU3RhdGUobnVsbCwgbnVsbCwgZWxlbWVudC5ocmVmKTtcbiAgICBvblN0YXRlQ2hhbmdlKCk7XG4gIH1cbn1cblxuLy8vIHN0YXRlQ2hhbmdlIGhhbmRsZXJcbmZ1bmN0aW9uIG9uU3RhdGVDaGFuZ2UoKSB7XG5cbiAgY29uc29sZS5sb2coSGlzdG9yeS5jdXJyU3RhdHVzKCkpO1xuXG4gIC8vIGdldCBuZXcgVVJMXG4gIHZhciBuZXdVcmwgPSBnZXRDdXJyZW50VXJsKCk7XG4gIC8vIGJhaWwgb3V0LCBpZiBjdXJyZW50IFVSTCBpcyBzYW1lIGFzIG5ldyBVUkxcbiAgaWYgKEhpc3RvcnkuY3VyclN0YXR1cygpLnVybCA9PT0gbmV3VXJsKSByZXR1cm4gZmFsc2U7XG4gIC8vIGNoZWNrIGlmIHRyYW5zaXRpb24gaW4gcHJvZ3Jlc3NcbiAgaWYgKFBqYXgudHJhbnNpdGlvbkluUHJvZ3Jlc3MpIHtcbiAgICAvLy8gaWYgdHJhbnMgaW4gcHJvZywgZm9yY2UgZ28gdG8gbmV3IFVSTFxuICAgIC8vLyBOQi4gdGhpcyBpcyB3aGVyZSB3ZSdkIGhhdmUgdG8gY2FuY2VsIHRoZSBjdXJyZW50IHRyYW5zaXRpb24gYW5kIHN0YXJ0IGFub3RoZXIgb25lXG4gICAgZm9yY2VHb1RvKG5ld1VybCk7XG4gIH1cbiAgLy8gb3RoZXJ3aXNlLi4uXG4gIC8vIGZpcmUgaW50ZXJuYWwgZXZlbnRzXG4gIERpc3BhdGNoZXIudHJpZ2dlcignc3RhdGVDaGFuZ2UnLCBIaXN0b3J5LmN1cnJTdGF0dXMoKSwgSGlzdG9yeS5wcmV2U3RhdHVzKCkpO1xuICAvLyBhZGQgVVJMIHRvIGludGVybmFsIGhpc3RvcnkgbWFuYWdlclxuICBIaXN0b3J5LmFkZChuZXdVcmwpO1xuICAvLyBnZXQgdGhlIHByb21pc2UgZm9yIHRoZSBuZXcgY29udGFpbmVyXG4gIHZhciBnb3RDb250YWluZXIgPSBQamF4LmxvYWQobmV3VXJsKTtcbiAgLy8gdGhpcyBzaG91bGQgbm90IGF0IGFsbCBiZSBuZWNlc3NhcnlcbiAgdmFyIHRyYW5zaXRpb24gPSBPYmplY3QuY3JlYXRlKFBqYXguZ2V0VHJhbnNpdGlvbigpKTtcbiAgUGpheC50cmFuc2l0aW9uSW5Qcm9ncmVzcyA9IHRydWU7XG4gIHZhciB0cmFuc2l0aW9uSW5zdGFuY2UgPSB0cmFuc2l0aW9uLmluaXQoXG4gICAgRG9tLmdldENvbnRhaW5lcigpLFxuICAgIGdvdENvbnRhaW5lclxuICApO1xuICBnb3RDb250YWluZXIudGhlbiggb25Db250YWluZXJMb2FkICk7XG4gIHRyYW5zaXRpb25JbnN0YW5jZS50aGVuKCBvblRyYW5zaXRpb25FbmQgKTtcbn1cblxuLy8vIGNvbnRhaW5lckxvYWQgaGFuZGxlclxuZnVuY3Rpb24gb25Db250YWluZXJMb2FkKGNvbnRhaW5lcikge1xuICB2YXIgY3VyclN0YXR1cyA9IEhpc3RvcnkuY3VyclN0YXR1cygpO1xuICBjdXJyU3RhdHVzLm5hbWVzcGFjZSA9IERvbS5nZXROYW1lc3BhY2UoY29udGFpbmVyKTtcbiAgRGlzcGF0Y2hlci50cmlnZ2VyKCdjb250YWluZXJMb2FkJyxcbiAgICBIaXN0b3J5LmN1cnJTdGF0dXMoKSxcbiAgICBIaXN0b3J5LnByZXZTdGF0dXMoKSxcbiAgICBjb250YWluZXJcbiAgKTtcbn1cblxuLy8vIHRyYW5zaXRpb25FbmQgaGFuZGxlclxuZnVuY3Rpb24gb25UcmFuc2l0aW9uRW5kKCkge1xuICBQamF4LnRyYW5zaXRpb25JblByb2dyZXNzID0gZmFsc2U7XG4gIERpc3BhdGNoZXIudHJpZ2dlcigndHJhbnNpdGlvbkVuZCcsXG4gICAgSGlzdG9yeS5jdXJyU3RhdHVzKCksXG4gICAgSGlzdG9yeS5wcmV2U3RhdHVzKClcbiAgKTtcbn1cblxuLy8vIFBKQVhcbnZhciBQamF4ID0gbW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgLy8vIHdoZXRoZXIgdG8gdXNlIGNhY2hlXG4gIGNhY2hlRW5hYmxlZDogdHJ1ZSxcblxuICAvLy8gd2hldGhlciB0cmFuc2l0aW9uIGlzIGluIHByb2dyZXNzXG4gIHRyYW5zaXRpb25JblByb2dyZXNzOiBmYWxzZSxcblxuICAvLy8gd2hhdCB0cmFuc2l0aW9uIHRvIHVzZVxuICAvLy8gKiBlaXRoZXIgY2hhbmdlIHRoaXMuLi5cbiAgZGVmYXVsdFRyYW5zaXRpb246IHJlcXVpcmUoJy4vUGpheC9IaWRlU2hvd1RyYW5zaXRpb24nKSxcbiAgLy8vIC4uLm9yIGNoYW5nZSB0aGlzLCB0byBhZmZlY3QgZGVmYXVsdHNcbiAgZ2V0VHJhbnNpdGlvbjogZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzLmRlZmF1bHRUcmFuc2l0aW9uOyB9LFxuXG4gIC8vLyBpbml0aWFsaXplXG4gIGluaXQ6IGZ1bmN0aW9uKCkge1xuXG4gICAgLy8gZ2V0IHRoZSBjb250YWluZXJcbiAgICB2YXIgY29udGFpbmVyID0gRG9tLmdldENvbnRhaW5lcigpO1xuXG4gICAgSGlzdG9yeS5hZGQoXG4gICAgICBnZXRDdXJyZW50VXJsKCksXG4gICAgICBEb20uZ2V0TmFtZXNwYWNlKGNvbnRhaW5lcilcbiAgICApO1xuXG4gICAgLy8gZmlyZSBjdXN0b20gZXZlbnRzIGZvciB0aGUgY3VycmVudCB2aWV3LlxuICAgIERpc3BhdGNoZXIudHJpZ2dlcignc3RhdGVDaGFuZ2UnLCBIaXN0b3J5LmN1cnJTdGF0dXMoKSk7XG4gICAgRGlzcGF0Y2hlci50cmlnZ2VyKCdjb250YWluZXJMb2FkJywgSGlzdG9yeS5jdXJyU3RhdHVzKCksIHt9LCBjb250YWluZXIpO1xuICAgIERpc3BhdGNoZXIudHJpZ2dlcigndHJhbnNpdGlvbkVuZCcsIEhpc3RvcnkuY3VyclN0YXR1cygpKTtcblxuICAgIC8vIGJpbmQgbmF0aXZlIGV2ZW50c1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgb25MaW5rQ2xpY2spO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdwb3BzdGF0ZScsIG9uU3RhdGVDaGFuZ2UpO1xuICB9LFxuXG4gIC8vLyBsb2FkIGEgbmV3IHBhZ2U7IHJldHVybiBQcm9taXNlXG4gIGxvYWQ6IGZ1bmN0aW9uKHVybCkge1xuICAgIHZhciBkZWZlcnJlZCA9IFV0aWxzLmRlZmVycmVkKCk7XG4gICAgdmFyIHhociA9IENhY2hlLmdldCh1cmwpO1xuICAgIGlmICgheGhyKSB7XG4gICAgICB4aHIgPSBVdGlscy54aHIodXJsKTtcbiAgICAgIENhY2hlLnNldCh1cmwsIHhocik7XG4gICAgfVxuICAgIHhoci50aGVuKFxuICAgICAgLy8gc3VjY2Vzc1xuICAgICAgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICB2YXIgY29udGFpbmVyID0gRG9tLnBhcnNlUmVzcG9uc2UoZGF0YSk7XG4gICAgICAgIERvbS5wdXRDb250YWluZXIoY29udGFpbmVyKTtcbiAgICAgICAgaWYgKCFQamF4LmNhY2hlRW5hYmxlZCkgQ2FjaGUucmVzZXQoKTtcbiAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShjb250YWluZXIpO1xuICAgICAgfSxcbiAgICAgIC8vIGVycm9yXG4gICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgd2luZG93LmxvY2F0aW9uID0gdXJsO1xuICAgICAgICBkZWZlcnJlZC5yZWplY3QoKTtcbiAgICAgIH1cbiAgICApO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICB9LFxuXG4gIC8vLyBleHBvc3VyZSBvZiBvdGhlciBvYmplY3RzXG4gIENhY2hlOiBDYWNoZSxcbiAgRG9tOiBEb20sXG4gIEhpc3Rvcnk6IEhpc3RvcnksXG4gIFByZWZldGNoOiBQcmVmZXRjaCxcbiAgVHJhbnNpdGlvbjogVHJhbnNpdGlvbixcbiAgVXRpbHM6IFV0aWxzLFxuICBWaWV3OiBWaWV3XG59O1xuIiwiLy8vIENBQ0hFXG52YXIgQ2FjaGUgPSBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgLy8gZXh0ZW5kIGZ1bmN0aW9uIC0tIG5lY2Vzc2FyeT9cbiAgZXh0ZW5kOiBmdW5jdGlvbihvYmopIHsgcmV0dXJuIFV0aWxzLmV4dGVuZCh0aGlzLCBvYmopOyB9LFxuICAvLyBob2xkZXJcbiAgZGF0YToge30sXG4gIC8vIHNldFxuICBzZXQ6IGZ1bmN0aW9uKGtleSwgdmFsKSB7IHRoaXMuZGF0YVtrZXldID0gdmFsOyB9LFxuICAvLyBnZXRcbiAgZ2V0OiBmdW5jdGlvbihrZXkpIHsgcmV0dXJuIHRoaXMuZGF0YVtrZXldOyB9LFxuICAvLyByZXNldFxuICByZXNldDogZnVuY3Rpb24oKSB7IHRoaXMuZGF0YSA9IHt9OyB9XG59O1xuIiwiLy8vIERPTVxudmFyIERvbSA9IG1vZHVsZS5leHBvcnRzID0ge1xuXG4gIC8vLyBkYXRhIE5BTUVTUEFDRSBkZWZhdWx0XG4gIGRhdGFOYW1lc3BhY2U6ICduYW1lc3BhY2UnLFxuXG4gIC8vLyB3cmFwcGVyIElEIGRlZmF1bHRcbiAgLy8vICogdGhlcmUgd2lsbCBvbmx5IGV2ZXIgYmUgb25lIG9mIHRoZXNlXG4gIHdyYXBwZXJJZDogJ3BqYXgtd3JhcHBlcicsXG5cbiAgLy8vIGNvbnRhaW5lciBDTEFTUyBkZWZhdWx0XG4gIC8vLyAqIHRoZXJlIHdpbGwgYXQgYSBwb2ludCBiZSB0d28gb2YgdGhlc2UgaW4gdGhlIERPTSAob2xkIGFuZCBuZXcpXG4gIGNvbnRhaW5lckNsYXNzOiAncGpheC1jb250YWluZXInLFxuXG4gIC8vLyBwYXJzZSB0aGUgcmVzcG9uc2UgZnJvbSBYSFJcbiAgLy8vIDEuIHBsYWNlIGNvbnRlbnQgaW4gZGV0YWNoZWQgZGl2XG4gIC8vLyAyLiBwYXJzZSBvdXQgPHRpdGxlPiBlbGVtZW50IHRleHQgYW5kIHNldCBpdFxuICAvLy8gMy4gZXh0cmFjdCB0aGUgbmV3Q29udGFpbmVyIGVsZW1lbnRcbiAgcGFyc2VSZXNwb25zZTogZnVuY3Rpb24ocmVzcG9uc2VUZXh0KSB7XG4gICAgdmFyIHdyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICB3cmFwcGVyLmlubmVySFRNTCA9IHJlc3BvbnNlVGV4dDtcbiAgICB2YXIgdGl0bGVFbCA9IHdyYXBwZXIucXVlcnlTZWxlY3RvcigndGl0bGUnKTtcbiAgICBpZiAodGl0bGVFbClcbiAgICAgIGRvY3VtZW50LnRpdGxlID0gdGl0bGVFbC50ZXh0Q29udGVudDtcbiAgICByZXR1cm4gdGhpcy5nZXRDb250YWluZXIod3JhcHBlcik7XG4gIH0sXG5cbiAgLy8vIGdldCB0aGUgd3JhcHBlclxuICBnZXRXcmFwcGVyOiBmdW5jdGlvbigpIHsgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHRoaXMud3JhcHBlcklkKTsgfSxcblxuICAvLy8gZ2V0IHRoZSBjb250YWluZXJcbiAgLy8vICogYWNjZXB0IGEgZ2l2ZW4gd3JhcHBlciwgb3IgdXNlIGRlZmF1bHQgd3JhcHBlclxuICBnZXRDb250YWluZXI6IGZ1bmN0aW9uKHdyYXBwZXIpIHtcbiAgICBpZiAoIXdyYXBwZXIpXG4gICAgICB3cmFwcGVyID0gdGhpcy5nZXRXcmFwcGVyKCk7XG4gICAgaWYgKCF3cmFwcGVyKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdCYXJiYS5qczogRE9NIG5vdCByZWFkeSEnKTtcbiAgICB2YXIgY29udGFpbmVyID0gd3JhcHBlci5xdWVyeVNlbGVjdG9yKCcuJyArIHRoaXMuY29udGFpbmVyQ2xhc3MpO1xuICAgIGlmIChjb250YWluZXIgJiYgY29udGFpbmVyLmpxdWVyeSlcbiAgICAgIGNvbnRhaW5lciA9IGNvbnRhaW5lclswXTtcbiAgICBpZiAoIWNvbnRhaW5lcilcbiAgICAgIHRocm93IG5ldyBFcnJvcignQmFyYmEuanM6IG5vIGNvbnRhaW5lciBmb3VuZCcpO1xuICAgIHJldHVybiBjb250YWluZXI7XG4gIH0sXG5cbiAgLy8vIGdldCB0aGUgbmFtZXNwYWNlIG9mIHRoZSBjb250YWluZXJcbiAgZ2V0TmFtZXNwYWNlOiBmdW5jdGlvbihjb250YWluZXIpIHtcbiAgICBpZiAoY29udGFpbmVyICYmIGNvbnRhaW5lci5kYXRhc2V0KSB7XG4gICAgICByZXR1cm4gY29udGFpbmVyLmRhdGFzZXRbdGhpcy5kYXRhTmFtZXNwYWNlXTtcbiAgICB9IGVsc2UgaWYgKGNvbnRhaW5lcikge1xuICAgICAgcmV0dXJuIGNvbnRhaW5lci5nZXRBdHRyaWJ1dGUoJ2RhdGEtJyArIHRoaXMuZGF0YU5hbWVzcGFjZSk7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8vLyBwdXQgdGhlIGNvbnRhaW5lciBpbiB0byB0aGUgd3JhcHBlciwgd2l0aCB2aXNpYmlsaXR5ICdoaWRkZW4nXG4gIHB1dENvbnRhaW5lcjogZnVuY3Rpb24oY29udGFpbmVyKSB7XG4gICAgY29udGFpbmVyLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICB0aGlzLmdldFdyYXBwZXIoKS5hcHBlbmRDaGlsZChjb250YWluZXIpO1xuICB9XG59O1xuIiwiLy8vIEhJU1RPUllcbnZhciBIaXN0b3J5ID0gbW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgaGlzdG9yeTogW10sXG5cbiAgYWRkOiBmdW5jdGlvbih1cmwsIG5hbWVzcGFjZSkge1xuICAgIGlmICghbmFtZXNwYWNlKVxuICAgICAgbmFtZXNwYWNlID0gdW5kZWZpbmVkO1xuXG4gICAgdGhpcy5oaXN0b3J5LnB1c2goe1xuICAgICAgdXJsOiB1cmwsXG4gICAgICBuYW1lc3BhY2U6IG5hbWVzcGFjZVxuICAgIH0pO1xuICB9LFxuXG4gIGxhc3Q6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmhpc3RvcnlbdGhpcy5oaXN0b3J5Lmxlbmd0aCAtIDFdO1xuICB9LFxuXG4gIGN1cnJTdGF0dXM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmhpc3RvcnlbdGhpcy5oaXN0b3J5Lmxlbmd0aCAtIDFdO1xuICB9LFxuXG4gIHByZXZTdGF0dXM6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBoaXN0b3J5ID0gdGhpcy5oaXN0b3J5O1xuXG4gICAgaWYgKGhpc3RvcnkubGVuZ3RoIDwgMilcbiAgICAgIHJldHVybiBudWxsO1xuXG4gICAgcmV0dXJuIGhpc3RvcnlbaGlzdG9yeS5sZW5ndGggLSAyXTtcbiAgfVxufTtcblxuIiwidmFyIFV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xudmFyIENhY2hlID0gcmVxdWlyZSgnLi9jYWNoZScpO1xuXG5mdW5jdGlvbiBvbkxpbmtFbnRlcihldmVudCkge1xuICAvLyBnZXQgZXZlbnQgdGFyZ2V0XG4gIHZhciBlbCA9IGV2ZW50LnRhcmdldDtcbiAgLy8gdHJhdmVyc2UgdXAgdW50aWwgdmFsaWQgaHJlZlxuICB3aGlsZSAoZWwgJiYgIWVsLmhyZWYpIHsgZWwgPSBlbC5wYXJlbnROb2RlOyB9XG4gIC8vIGlmIG5vdGhpbmcgZm91bmQsIGJhaWxcbiAgaWYgKCFlbCkgeyByZXR1cm47IH1cbiAgLy8gZ2V0IHRoZSBVUkxcbiAgdmFyIHVybCA9IGVsLmhyZWY7XG4gIC8vIGlmIGxpbmsgaXMgdmFsaWQuLi5cbiAgaWYgKFV0aWxzLnZhbGlkTGluayhlbCwgZXZlbnQpICYmICFDYWNoZS5nZXQodXJsKSkge1xuICAgIC8vIGdldCB0aGUgY29udGVudFxuICAgIHZhciB4aHIgPSBVdGlscy54aHIodXJsKTtcbiAgICAvLyBidW5nIGl0IGluIHRoZSBjYWNoZVxuICAgIENhY2hlLnNldCh1cmwsIHhocik7XG4gIH1cbn1cblxuLy8vIFBSRUZFVENIXG52YXIgUHJlZmV0Y2ggPSBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgZG9jdW1lbnQuYm9keS5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW92ZXInLCBvbkxpbmtFbnRlcik7XG4gICAgZG9jdW1lbnQuYm9keS5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0Jywgb25MaW5rRW50ZXIpO1xuICB9XG59O1xuIiwiLyoqXG4gKiBKdXN0IGFuIG9iamVjdCB3aXRoIHNvbWUgaGVscGZ1bCBmdW5jdGlvbnNcbiAqXG4gKiBAdHlwZSB7T2JqZWN0fVxuICogQG5hbWVzcGFjZSBCYXJiYS5VdGlsc1xuICovXG52YXIgVXRpbHMgPSB7XG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGN1cnJlbnQgdXJsXG4gICAqXG4gICAqIEBtZW1iZXJPZiBCYXJiYS5VdGlsc1xuICAgKiBAcmV0dXJuIHtTdHJpbmd9IGN1cnJlbnRVcmxcbiAgICovXG4gIGdldEN1cnJlbnRVcmw6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2wgKyAnLy8nICtcbiAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLmhvc3QgK1xuICAgICAgICAgICB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgK1xuICAgICAgICAgICB3aW5kb3cubG9jYXRpb24uc2VhcmNoO1xuICB9LFxuXG4gIC8qKlxuICAgKiBHaXZlbiBhbiB1cmwsIHJldHVybiBpdCB3aXRob3V0IHRoZSBoYXNoXG4gICAqXG4gICAqIEBtZW1iZXJPZiBCYXJiYS5VdGlsc1xuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHVybFxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IG5ld0NsZWFuVXJsXG4gICAqL1xuICBjbGVhbkxpbms6IGZ1bmN0aW9uKHVybCkge1xuICAgIHJldHVybiB1cmwucmVwbGFjZSgvIy4qLywgJycpO1xuICB9LFxuXG4gIC8vLyB3aGV0aGVyIGEgbGluayBzaG91bGQgYmUgZm9sbG93ZWRcbiAgdmFsaWRMaW5rOiBmdW5jdGlvbihlbGVtZW50LCBldmVudCkge1xuICAgIGlmICghaGlzdG9yeS5wdXNoU3RhdGUpIHJldHVybiBmYWxzZTtcbiAgICAvLy8gdXNlclxuICAgIGlmICghZWxlbWVudCB8fCAhZWxlbWVudC5ocmVmKSByZXR1cm4gZmFsc2U7XG4gICAgLy8vIG1pZGRsZSBjbGljaywgY21kIGNsaWNrLCBhbmQgY3RybCBjbGlja1xuICAgIGlmIChldmVudC53aGljaCA+IDEgfHwgZXZlbnQubWV0YUtleSB8fCBldmVudC5jdHJsS2V5IHx8IGV2ZW50LnNoaWZ0S2V5IHx8IGV2ZW50LmFsdEtleSkgcmV0dXJuIGZhbHNlO1xuICAgIC8vLyBpZ25vcmUgdGFyZ2V0IHdpdGggX2JsYW5rIHRhcmdldFxuICAgIGlmIChlbGVtZW50LnRhcmdldCAmJiBlbGVtZW50LnRhcmdldCA9PT0gJ19ibGFuaycpIHJldHVybiBmYWxzZTtcbiAgICAvLy8gY2hlY2sgaWYgaXQncyB0aGUgc2FtZSBkb21haW5cbiAgICBpZiAod2luZG93LmxvY2F0aW9uLnByb3RvY29sICE9PSBlbGVtZW50LnByb3RvY29sIHx8IHdpbmRvdy5sb2NhdGlvbi5ob3N0bmFtZSAhPT0gZWxlbWVudC5ob3N0bmFtZSkgcmV0dXJuIGZhbHNlO1xuICAgIC8vLyBjaGVjayBpZiB0aGUgcG9ydCBpcyB0aGUgc2FtZVxuICAgIGlmIChVdGlscy5nZXRQb3J0KCkgIT09IFV0aWxzLmdldFBvcnQoZWxlbWVudC5wb3J0KSkgcmV0dXJuIGZhbHNlO1xuICAgIC8vLyBpZ25vcmUgY2FzZSB3aGVuIGEgaGFzaCBpcyBiZWluZyB0YWNrZWQgb24gdGhlIGN1cnJlbnQgdXJsXG4gICAgaWYgKGVsZW1lbnQuaHJlZi5pbmRleE9mKCcjJykgPiAtMSkgcmV0dXJuIGZhbHNlO1xuICAgIC8vLyBpbiBjYXNlIHlvdSdyZSB0cnlpbmcgdG8gbG9hZCB0aGUgc2FtZSBwYWdlXG4gICAgaWYgKFV0aWxzLmNsZWFuTGluayhlbGVtZW50LmhyZWYpID09IFV0aWxzLmNsZWFuTGluayhsb2NhdGlvbi5ocmVmKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChlbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnbm8tYmFyYmEnKSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9LFxuXG4gIC8qKlxuICAgKiBUaW1lIGluIG1pbGxpc2Vjb25kIGFmdGVyIHRoZSB4aHIgcmVxdWVzdCBnb2VzIGluIHRpbWVvdXRcbiAgICpcbiAgICogQG1lbWJlck9mIEJhcmJhLlV0aWxzXG4gICAqIEB0eXBlIHtOdW1iZXJ9XG4gICAqIEBkZWZhdWx0XG4gICAqL1xuICB4aHJUaW1lb3V0OiA1MDAwLFxuXG4gIC8qKlxuICAgKiBTdGFydCBhbiBYTUxIdHRwUmVxdWVzdCgpIGFuZCByZXR1cm4gYSBQcm9taXNlXG4gICAqXG4gICAqIEBtZW1iZXJPZiBCYXJiYS5VdGlsc1xuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHVybFxuICAgKiBAcmV0dXJuIHtQcm9taXNlfVxuICAgKi9cbiAgeGhyOiBmdW5jdGlvbih1cmwpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSB0aGlzLmRlZmVycmVkKCk7XG4gICAgdmFyIHJlcSA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgcmVxLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHJlcS5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgIGlmIChyZXEuc3RhdHVzID09PSAyMDApIHtcbiAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucmVzb2x2ZShyZXEucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucmVqZWN0KG5ldyBFcnJvcigneGhyOiBIVFRQIGNvZGUgaXMgbm90IDIwMCcpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICByZXEub250aW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZGVmZXJyZWQucmVqZWN0KG5ldyBFcnJvcigneGhyOiBUaW1lb3V0IGV4Y2VlZGVkJykpO1xuICAgIH07XG5cbiAgICByZXEub3BlbignR0VUJywgdXJsKTtcbiAgICByZXEudGltZW91dCA9IHRoaXMueGhyVGltZW91dDtcbiAgICByZXEuc2V0UmVxdWVzdEhlYWRlcigneC1iYXJiYScsICd5ZXMnKTtcbiAgICByZXEuc2VuZCgpO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEdldCBvYmogYW5kIHByb3BzIGFuZCByZXR1cm4gYSBuZXcgb2JqZWN0IHdpdGggdGhlIHByb3BlcnR5IG1lcmdlZFxuICAgKlxuICAgKiBAbWVtYmVyT2YgQmFyYmEuVXRpbHNcbiAgICogQHBhcmFtICB7b2JqZWN0fSBvYmpcbiAgICogQHBhcmFtICB7b2JqZWN0fSBwcm9wc1xuICAgKiBAcmV0dXJuIHtvYmplY3R9XG4gICAqL1xuICBleHRlbmQ6IGZ1bmN0aW9uKG9iaiwgcHJvcHMpIHtcbiAgICB2YXIgbmV3T2JqID0gT2JqZWN0LmNyZWF0ZShvYmopO1xuXG4gICAgZm9yKHZhciBwcm9wIGluIHByb3BzKSB7XG4gICAgICBpZihwcm9wcy5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICBuZXdPYmpbcHJvcF0gPSBwcm9wc1twcm9wXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3T2JqO1xuICB9LFxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBuZXcgXCJEZWZlcnJlZFwiIG9iamVjdFxuICAgKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL01vemlsbGEvSmF2YVNjcmlwdF9jb2RlX21vZHVsZXMvUHJvbWlzZS5qc20vRGVmZXJyZWRcbiAgICpcbiAgICogQHJldHVybiB7RGVmZXJyZWR9XG4gICAqL1xuICBkZWZlcnJlZDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMucmVzb2x2ZSA9IG51bGw7XG4gICAgICB0aGlzLnJlamVjdCA9IG51bGw7XG5cbiAgICAgIHRoaXMucHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICB0aGlzLnJlc29sdmUgPSByZXNvbHZlO1xuICAgICAgICB0aGlzLnJlamVjdCA9IHJlamVjdDtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfTtcbiAgfSxcblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBwb3J0IG51bWJlciBub3JtYWxpemVkLCBldmVudHVhbGx5IHlvdSBjYW4gcGFzcyBhIHN0cmluZyB0byBiZSBub3JtYWxpemVkLlxuICAgKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHBcbiAgICogQHJldHVybiB7SW50fSBwb3J0XG4gICAqL1xuICBnZXRQb3J0OiBmdW5jdGlvbihwKSB7XG4gICAgdmFyIHBvcnQgPSB0eXBlb2YgcCAhPT0gJ3VuZGVmaW5lZCcgPyBwIDogd2luZG93LmxvY2F0aW9uLnBvcnQ7XG4gICAgdmFyIHByb3RvY29sID0gd2luZG93LmxvY2F0aW9uLnByb3RvY29sO1xuXG4gICAgaWYgKHBvcnQgIT0gJycpXG4gICAgICByZXR1cm4gcGFyc2VJbnQocG9ydCk7XG5cbiAgICBpZiAocHJvdG9jb2wgPT09ICdodHRwOicpXG4gICAgICByZXR1cm4gODA7XG5cbiAgICBpZiAocHJvdG9jb2wgPT09ICdodHRwczonKVxuICAgICAgcmV0dXJuIDQ0MztcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBVdGlscztcbiIsInZhciBEaXNwYXRjaGVyID0gcmVxdWlyZSgnLi4vZGlzcGF0Y2hlcicpO1xudmFyIFV0aWxzICAgICAgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbi8vLyBWSUVXXG52YXIgVmlldyA9IG1vZHVsZS5leHBvcnRzID0ge1xuICBleHRlbmQ6IGZ1bmN0aW9uKG9iail7IHJldHVybiBVdGlscy5leHRlbmQodGhpcywgb2JqKTsgfSxcblxuICBuYW1lc3BhY2U6IG51bGwsXG5cbiAgbmV3U3RhcnQ6IGZ1bmN0aW9uKCkge30sXG4gIG5ld0NvbXBsZXRlOiBmdW5jdGlvbigpIHt9LFxuICBvbGRTdGFydDogZnVuY3Rpb24oKSB7fSxcbiAgb2xkQ29tcGxldGU6IGZ1bmN0aW9uKCkge30sXG5cbiAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgIERpc3BhdGNoZXIub24oJ3N0YXRlQ2hhbmdlJyxcbiAgICAgIGZ1bmN0aW9uKG5ld1N0YXR1cywgb2xkU3RhdHVzKSB7XG4gICAgICAgIGlmIChvbGRTdGF0dXMgJiYgb2xkU3RhdHVzLm5hbWVzcGFjZSA9PT0gX3RoaXMubmFtZXNwYWNlKVxuICAgICAgICAgIC8vIG9sZENvbnRhaW5lciByZWFkeSB0byB0cmFucyBPVVRcbiAgICAgICAgICBfdGhpcy5vbGRTdGFydCgpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICBEaXNwYXRjaGVyLm9uKCdjb250YWluZXJMb2FkJyxcbiAgICAgIGZ1bmN0aW9uKG5ld1N0YXR1cywgb2xkU3RhdHVzLCBjb250YWluZXIpIHtcbiAgICAgICAgX3RoaXMuY29udGFpbmVyID0gY29udGFpbmVyO1xuXG4gICAgICAgIGlmIChuZXdTdGF0dXMubmFtZXNwYWNlID09PSBfdGhpcy5uYW1lc3BhY2UpXG4gICAgICAgICAgLy8gbmV3Q29udGFpbmVyIGlzIHJlYWR5IHRvIHRyYW5zIElOXG4gICAgICAgICAgX3RoaXMubmV3U3RhcnQoKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgRGlzcGF0Y2hlci5vbigndHJhbnNpdGlvbkVuZCcsXG4gICAgICBmdW5jdGlvbihuZXdTdGF0dXMsIG9sZFN0YXR1cykge1xuICAgICAgICBpZiAobmV3U3RhdHVzLm5hbWVzcGFjZSA9PT0gX3RoaXMubmFtZXNwYWNlKVxuICAgICAgICAgIC8vIG5ld0NvbnRhaW5lciB0cmFucyBJTiBpcyBjb21wbGV0ZVxuICAgICAgICAgIF90aGlzLm5ld0NvbXBsZXRlKCk7XG5cbiAgICAgICAgaWYgKG9sZFN0YXR1cyAmJiBvbGRTdGF0dXMubmFtZXNwYWNlID09PSBfdGhpcy5uYW1lc3BhY2UpXG4gICAgICAgICAgLy8gb2xkQ29udGFpbmVyIHRyYW5zIE9VVCBpcyBjb21wbGV0ZVxuICAgICAgICAgIF90aGlzLm9sZENvbXBsZXRlKCk7XG4gICAgICB9XG4gICAgKTtcbiAgfVxufVxuIiwiZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uKCkge1xuXG4gIHZhciBsYXN0RWxlbWVudENsaWNrZWQ7XG4gIHZhciBQcmV2TGluayA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2EucHJldicpO1xuICB2YXIgTmV4dExpbmsgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdhLm5leHQnKTtcblxuICB2YXIgUGpheCA9IHJlcXVpcmUoJy4uLy4uL3NyYy9wamF4Jyk7XG4gIHZhciBEaXNwYXRjaGVyID0gcmVxdWlyZSgnLi4vLi4vc3JjL2Rpc3BhdGNoZXInKTtcblxuICBQamF4LmluaXQoKTtcbiAgUGpheC5QcmVmZXRjaC5pbml0KCk7XG5cbiAgRGlzcGF0Y2hlci5vbignbGlua0NsaWNrZWQnLCBmdW5jdGlvbihlbCkge1xuICAgIGxhc3RFbGVtZW50Q2xpY2tlZCA9IGVsO1xuICB9KTtcblxuICAvLyBjb25zb2xlLmxvZyhQamF4KTtcblxuICB2YXIgTW92ZVBhZ2UgPSBQamF4LlRyYW5zaXRpb24uZXh0ZW5kKHtcbiAgICByZW5kZXIoKSB7XG4gICAgICB0aGlzLm9yaWdpbmFsVGh1bWIgPSBsYXN0RWxlbWVudENsaWNrZWQ7XG5cbiAgICAgIFByb21pc2VcbiAgICAgICAgLmFsbChbdGhpcy5jb250YWluZXJMb2FkZWQsIHNjcm9sbFRvcCgpXSlcbiAgICAgICAgLnRoZW4obW92ZVBhZ2VzLmJpbmQodGhpcykpO1xuICAgIH1cbiAgfSk7XG5cbiAgUGpheC5kZWZhdWx0VHJhbnNpdGlvbiA9IE1vdmVQYWdlO1xuXG4gIGZ1bmN0aW9uIHNjcm9sbFRvcCgpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBQamF4LlV0aWxzLmRlZmVycmVkKCk7XG4gICAgdmFyIG9iaiA9IHsgeTogd2luZG93LnBhZ2VZT2Zmc2V0IH07XG5cbiAgICBUd2VlbkxpdGUudG8ob2JqLCAwLjQsIHtcbiAgICAgIHk6IDAsXG4gICAgICBvblVwZGF0ZSgpIHtcbiAgICAgICAgaWYgKG9iai55ID09PSAwKSB7XG4gICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgd2luZG93LnNjcm9sbCgwLCBvYmoueSk7XG4gICAgICB9LFxuICAgICAgb25Db21wbGV0ZSgpIHtcbiAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gIH1cblxuICBmdW5jdGlvbiBtb3ZlUGFnZXMoKSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcbiAgICB2YXIgZ29pbmdGb3J3YXJkID0gdHJ1ZTtcbiAgICBQcmV2TGluay5ocmVmID0gdGhpcy5uZXdDb250YWluZXIuZGF0YXNldC5wcmV2O1xuICAgIE5leHRMaW5rLmhyZWYgPSB0aGlzLm5ld0NvbnRhaW5lci5kYXRhc2V0Lm5leHQ7XG5cbiAgICBpZiAoZ2V0TmV3UGFnZUZpbGUoKSA9PT0gdGhpcy5vbGRDb250YWluZXIuZGF0YXNldC5wcmV2KSB7XG4gICAgICBnb2luZ0ZvcndhcmQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBUd2VlbkxpdGUuc2V0KHRoaXMubmV3Q29udGFpbmVyLCB7XG4gICAgICB2aXNpYmlsaXR5OiAndmlzaWJsZScsXG4gICAgICB4UGVyY2VudDogZ29pbmdGb3J3YXJkID8gMTAwIDogLTEwMCxcbiAgICAgIHBvc2l0aW9uOiAnZml4ZWQnLFxuICAgICAgbGVmdDogMCxcbiAgICAgIHRvcDogMCxcbiAgICAgIHJpZ2h0OiAwXG4gICAgfSk7XG5cbiAgICBUd2VlbkxpdGUudG8odGhpcy5vbGRDb250YWluZXIsIDAuNiwge3hQZXJjZW50OiBnb2luZ0ZvcndhcmQgPyAtMTAwIDogMTAwfSk7XG4gICAgVHdlZW5MaXRlLnRvKHRoaXMubmV3Q29udGFpbmVyLCAwLjYsIHt4UGVyY2VudDogMCwgb25Db21wbGV0ZSgpIHtcbiAgICAgIFR3ZWVuTGl0ZS5zZXQoX3RoaXMubmV3Q29udGFpbmVyLCB7Y2xlYXJQcm9wczogJ2FsbCcgfSk7XG4gICAgICBfdGhpcy5yZXNvbHZlKCk7XG4gICAgfX0pO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlTGlua3MoKSB7XG4gICAgUHJldkxpbmsuaHJlZiA9IHRoaXMubmV3Q29udGFpbmVyLmRhdGFzZXQucHJldjtcbiAgICBOZXh0TGluay5ocmVmID0gdGhpcy5uZXdDb250YWluZXIuZGF0YXNldC5uZXh0O1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0TmV3UGFnZUZpbGUgKCkge1xuICAgIHJldHVybiBQamF4Lkhpc3RvcnkuY3VyclN0YXR1cygpLnVybC5zcGxpdCgnLycpLnBvcCgpO1xuICB9XG5cbn0pO1xuIl19
