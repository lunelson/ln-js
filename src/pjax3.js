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

  init() {

    if (this.initialized) throw new Error('Pjax: attempted to initialize twice');

    this.cache = new Cache();
    this.rootEl = document.getElementById('pjax') || document.body,

    this.navState = new Stack();
    this.docState = Promise.resolve(this.rootEl),
    this.getTransition = function(newAction, currAction){ return require('./pjax2-transition-default'); },

    // listeners
    document.body.addEventListener('mouseover', handlePointer.bind(this));
    document.body.addEventListener('touchstart', handlePointer.bind(this));
    document.body.addEventListener('click', handleClick.bind(this));
    window.addEventListener('popstate', handlePopState.bind(this));

    this.initialized = true;
    return this;
  },

  navigate(newAction, currAction) {

    let newDoc = loadNewDoc.call(this, newAction);
    this.docState = this.docState.then((currDoc) => {
      return this.getTransition(newAction, currAction).render(newAction, newDoc, currDoc);
    }).then(([currDoc, prevDoc]) => {
      // do any final cleanups here
      return currDoc;
    }); // still a Promise here, which resolves currDoc
  }
};

module.exports = Pjax;

//////////////
// HANDLERS //
//////////////

function handlePointer(event) {
  // if link and prefetch-link and pjax-link and prefetch=true
  if (Utils.validPrefetch(element)) this.cache.set(element.href, Ajax.get(element.href));

}

function handleClick(event) {
  // resolve the element
  let element = event.target;
  while (element && !element.href) element = element.parentNode;
  // validate; TODO: change this function -- only proceed if href valid, and href != window.location.href
  if (Utils.validLink(element, event)) {
    // stop native event
    event.stopPropagation();
    event.preventDefault();
    let newAction = { url: element.href, stamp: Date.now() };
    let currAction = this.navState.curr();
    this.navState.push(newAction.stamp, newAction);
    newAction.click = element;
    this.navigate(newAction, currAction);
  }
}

function handlePopState(event) {
  // currAction = State.curr()
  // newAction = State.seek(window.history.state)
  // newAction.popstate = (newAction.stamp < currAction.stamp) ? 'back' : 'forward'
  // this.navigate(newAction, currAction)
}


function loadNewDoc(newAction) {
  let url = newAction.url;
  let newDoc = (this.cache.get(url)||this.cache.set(url, Ajax.get(url))).then((html)=>{
    // parse out and set document title
    // if newAction is a push, push the state
    if (newAction.click) window.history.pushState(newAction.stamp, title, element.href);

    return html;
  }).catch(log);
  return newDoc;
}
