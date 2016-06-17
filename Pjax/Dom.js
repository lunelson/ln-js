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
  parseResponse: function(responseText) {
    var wrapper = document.createElement('div');
    wrapper.innerHTML = responseText;
    var titleEl = wrapper.querySelector('title');
    if (titleEl)
      document.title = titleEl.textContent;
    return this.getContainer(wrapper);
  },

  /// get the wrapper
  getWrapper: function() { return document.getElementById(this.wrapperId); },

  /// get the container
  /// * accept a given wrapper, or use default wrapper
  getContainer: function(wrapper) {
    if (!wrapper)
      wrapper = this.getWrapper();
    if (!wrapper)
      throw new Error('Barba.js: DOM not ready!');
    var container = wrapper.querySelector('.' + this.containerClass);
    if (container && container.jquery)
      container = container[0];
    if (!container)
      throw new Error('Barba.js: no container found');
    return container;
  },

  /// get the namespace of the container
  getNamespace: function(container) {
    if (container && container.dataset) {
      return container.dataset[this.dataNamespace];
    } else if (container) {
      return container.getAttribute('data-' + this.dataNamespace);
    }
    return null;
  },

  /// put the container in to the wrapper, with visibility 'hidden'
  putContainer: function(container) {
    container.style.visibility = 'hidden';
    this.getWrapper().appendChild(container);
  }
};
