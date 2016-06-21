var Utils = {

  getHTML(url){
    var req = new XMLHttpRequest();
    return new Promise((resolve, reject) => {
       req.ontimeout = () => reject(new Error('xhr: Timeout exceeded'));
       req.onreadystatechange = () => {
        if (req.readyState === 4) {
          if (req.status != 200) return reject(new Error('xhr: HTTP code is not 200'));
          resolve(req.responseText);
        }
      };
      req.open('GET', url);
      req.setRequestHeader('x-pjax', 'yes');
      req.timeout = 5000;
      req.send();
    });
  },

  currUrl() {
    return `${window.location.protocol}//${window.location.host}${window.location.pathname}${window.location.search}`;
  },

  cleanLink(url) {
    return url.replace(/#.*/, '');
  },

  validLink(element, event) {
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

  getPort(p) {
    var port = typeof p !== 'undefined' ? p : window.location.port;
    var protocol = window.location.protocol;

    if (port != '')
      return parseInt(port);

    if (protocol === 'http:')
      return 80;

    if (protocol === 'https:')
      return 443;
  }
};

module.exports = Utils;
