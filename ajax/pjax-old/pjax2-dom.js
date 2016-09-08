// ______ _                  ______
// | ___ (_)                 |  _  \
// | |_/ /_  __ ___  ________| | | |___  _ __ ___
// |  __/| |/ _` \ \/ /______| | | / _ \| '_ ` _ \
// | |   | | (_| |>  <       | |/ / (_) | | | | | |
// \_|   | |\__,_/_/\_\      |___/ \___/|_| |_| |_|
//      _/ |
//     |__/

const Dom = {

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
  parseNewContainer(responseText) {
    var newWrapper = document.createElement('div');
    newWrapper.innerHTML = responseText;
    var titleEl = newWrapper.querySelector('title');
    if (titleEl)
      document.title = titleEl.textContent;
    return this.currContainer(newWrapper);
  },

  /// get the wrapper
  currWrapper() { return document.getElementById(this.wrapperId); },

  /// get the container
  /// * accept a given wrapper, or use default wrapper
  currContainer(wrapper) {
    if (!wrapper)
      wrapper = this.currWrapper();
    if (!wrapper)
      throw new Error('pjax-g: DOM not ready');
    var container = wrapper.querySelector(`.${this.containerClass}`);
    if (container && container.jquery)
      container = container[0];
    if (!container)
      throw new Error('pjax-g: no container found');
    return container;
  },

  /// get the namespace of the container
  containerNamespace(container) {
    if (container && container.dataset) {
      return container.dataset[this.dataNamespace];
    } else if (container) {
      return container.getAttribute('data-' + this.dataNamespace);
    }
    return null;
  },

  /// put the container in to the wrapper, with visibility 'hidden'
  appendContainer(container) {
    container.style.visibility = 'hidden';
    this.currWrapper().appendChild(container);
    return container;
  },

  swapContainers(args) {
    const [newContainer, oldContainer] = args;
    const wrapper = this.currWrapper();
    wrapper.removeChild(oldContainer);
    wrapper.appendChild(newContainer);
    return newContainer;
  }

};

module.exports = Dom;
