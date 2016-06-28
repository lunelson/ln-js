// ______ _            _____
// | ___ (_)          |____ |
// | |_/ /_  __ ___  __   / /
// |  __/| |/ _` \ \/ /   \ \
// | |   | | (_| |>  <.___/ /
// \_|   | |\__,_/_/\_\____/
//      _/ |
//     |__/

const Emitter = require('./emitter');
const Stack = require('./navstack');
const Cache = require('./cache');
const Ajax = require('./ajax');

const Pjax = {

  contentId: 'pjax-root',
  prefetchAttr: 'prefetch',
  prefetchActive: true,
  Transition: require('./pjax3-trans'),

  init(prefetch=true) {

    if (this.initialized) throw new Error('Pjax.init: attempted to initialize twice');
    this.initialized = true;

    let contentRoot = document.getElementById(this.contentId);
    if (!contentRoot) throw new Error('Pjax.init: no content element found')

    this.contentChain = Promise.resolve(contentRoot);
    this.navStates = new Stack();
    this.cache = new Cache();

    this.prefetchActive = prefetch;
    this.selectTransition = () => { return require('./pjax3-trans-default'); };

    // TODO: push the first state and replaceState with timestamped version
    // this.navStates.push({})
    // window.history.replaceState(Date.now())

    document.body.addEventListener('mouseover', handlePointer.bind(this));
    document.body.addEventListener('touchstart', handlePointer.bind(this));
    document.body.addEventListener('click', handleClick.bind(this));
    window.addEventListener('popstate', handlePopState.bind(this));

    return this;
  },

  navigate(newState, oldState) {
    let newContentLoad = loadContent.call(this, newState);
    this.contentChain = this.contentChain.then((oldContent) => {
      return this
        .selectTransition(newState, oldState)
        .render(newContentLoad, oldContent, newState, oldState);
    }); // newContentLoad is returned
  }

};

module.exports = Pjax;

//////////////
// HANDLERS //
//////////////

// ✅
function handlePointer(event) {
  if (!window.history.pushState) return false;

  if (isPrefetchElement.call(this, event.target) && this.prefetchActive)
    this.cache.set(element.href, Ajax.get(element.href));
}

// ✅
function handleClick(event) {
  if (!window.history.pushState) return false;

  let element = event.target;
  while (element && !element.href) element = element.parentNode;

  if (isPjaxEvent(event) && isPjaxElement(element)) {

    event.stopPropagation();
    event.preventDefault();

    let oldState = this.navStates.curr();
    let newState = { url: cleanHref(element.href), stamp: Date.now() };
    this.navStates.push(newState.stamp, newState);
    newState.event = event;
    newState.target = element;
    this.navigate(newState, oldState);
  }
}

// ✅
function handlePopState(event) {
  console.log(window.history.state);
  if (!window.history.pushState) return false;
  let oldState = this.navStates.curr()
  let newState = this.navStates.seek(window.history.state)
  newState.event = event;
  // TODO: can you determine fwd or rev from examining the event?
  newState.direction = (newState.stamp < oldState.stamp) ? 'back' : 'forward';
  this.navigate(newState, oldState);
}

// ✅
function isPjaxEvent(event) {
  if (event.which > 1 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  return true;
}

// ✅
function isPjaxElement(element) {
  if (!element || !element.href) return false;
  if (element.target && element.target === '_blank') return false;
  if (window.location.protocol !== element.protocol || window.location.hostname !== element.hostname) return false;
  if (parsePort(window.location.port) !== parsePort(element.port)) return false;
  if (cleanHref(window.location.href) === cleanHref(element.href)) return false;
  if (element.href.indexOf('#') > -1) return false;
  if (element.classList.contains('no-pjax')) return false;
  return true;
}

// ✅
function isPrefetchElement(element) { return (element.dataset[this.prefetchDataAttr]!=undefined && element.href); }

// ✅
function cleanHref(url) { return url.replace(/#.*/, ''); }

// ✅
function parsePort(port) {
  port = port || window.location.port;
  var protocol = window.location.protocol;
  if (port != '') return parseInt(port);
  if (protocol === 'https:') return 443;
  return 80;
}

// ✅
function loadContent(state) {
  return (this.cache.get(state.url)||this.cache.set(state.url, Ajax.get(state.url)))
    .then((html) => {
      let tempNode = document.createElement('div'); tempNode.innerHTML = html;
      let titleNode = tempNode.querySelector('title');
      if (titleNode) document.title = titleNode.textContent;
      // TODO: verify that this is how pushState works, wrt document.title
      if (state.event.type === 'click') window.history.pushState(state.stamp, document.title, state.url);
      let content = tempNode.querySelector(`#${this.contentId}`);
      if (!content) throw new Error('Pjax.loadContent: no content element found')
      return content;
    }).catch(log);
}

const log = console.log.bind(console);