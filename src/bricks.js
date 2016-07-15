module.exports = function(options = {}) {

  var persist;
  var ticking;
  var sizeInfoIndex;
  var sizeInfo;
  var colHeights;
  var nodes;
  var nodeWidth;
  var nodeHeights;

  // options

  // what is this, if the options are empty? should it have a default?
  var container = document.querySelector(options.container)
  // make sure `packed` has 'data-' prefix
  var packed    = options.packed.indexOf('data-') === 0 ? options.packed : `data-${ options.packed }`
  // make a copy of sizes array, reversed
  var sizes     = options.sizes.slice().reverse()
  // sounds like 'packed' is a way of not affecting certain elements
  var selectors = {
    all: `${ options.container } > *`,
    new: `${ options.container } > *:not([${ packed }])`
  }

  // series

  var layoutFns = [setSizeIndex, setSizeDetail, zeroColumnHeights];
  var updateFns = [setNodes, measureNodes, mutateNodes, mutateContainer];

  // instance
  // will have pack, update and resize methods, in addition to knot methods
  var instance = knot({
    pack,
    update,
    resize
  })

  return instance

  // general helpers
  function runFnSeries(series) { series.forEach((fn) => fn()) }

  // array helpers
  function nodeArray(selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); }
  function zeroArray(length) { return Array.apply(null, Array(length)).map(() => 0); }

  // size helpers

  function getSizeIndex() {
    // find index of first (narrowest) matching min-width media query
    // NB should possibly have sorted these first
    return sizes
      .map((size) => size.mq && window.matchMedia(`(min-width: ${ size.mq })`).matches)
      .indexOf(true)
  }

  function setSizeIndex() {
    sizeInfoIndex = getSizeIndex()
  }

  function setSizeDetail() {
    // if no media queries matched, use the base case
    sizeInfo = (sizeInfoIndex === -1)
      ? sizes[sizes.length - 1]
      : sizes[sizeInfoIndex]
  }

  // column helpers
  function zeroColumnHeights() { colHeights = zeroArray(sizeInfo.columns); }

  // node helpers
  function setNodes() { nodes = nodeArray(persist ? selectors.new : selectors.all); }

  function measureNodes() {
    if (nodes.length === 0) return;
    nodeWidth = nodes[0].clientWidth;
    nodeHeights = nodes.map((node) => node.clientHeight);
  }

  function mutateNodes() {
    nodes.forEach((node, index) => {
      var nodeHeight = nodeHeights[index];
      var colNumber = colHeights.indexOf(colHeights.reduce((currHeight, nextHeight) => (currHeight - nextHeight) >= nodeHeight/2 ? nextHeight : currHeight));

      node.style.position  = 'absolute';
      node.style.top       = `${ colHeights[colNumber] }px`;
      // TODO: make the left style percentage based; eliminate horizontal gutter
      node.style.left      = `${ (colNumber * nodeWidth) + (colNumber * sizeInfo.gutter) }px`;

      node.setAttribute(packed, '');

      colHeights[colNumber] += nodeHeights[index] + sizeInfo.gutter;
    })
  }

  // container helpers

  function mutateContainer() {
    container.style.position = 'relative'
    container.style.width    = `${ sizeInfo.columns * nodeWidth + (sizeInfo.columns - 1) * sizeInfo.gutter }px`
    container.style.height   = `${ Math.max.apply(Math, colHeights) - sizeInfo.gutter }px`
  }

  // resize helpers

  function resizeFrame() {
    if(!ticking) {
      requestAnimationFrame(resizeHandler)
      ticking = true
    }
  }

  function resizeHandler() {
    if(sizeInfoIndex !== getSizeIndex()) {
      pack()
      instance.emit('resize', sizeInfo)
    }

    ticking = false
  }

  // API

  function pack() {
    persist = false // causes everything to pack
    runFnSeries(layoutFns.concat(updateFns)) // do layoutFns, and updateFns series

    return instance.emit('pack')
  }

  function update() {
    persist = true // causes only unpacked to pack
    runFnSeries(updateFns) // do only updateFns series

    return instance.emit('update')
  }

  function resize(flag = true) {
    var action = flag
      ? 'addEventListener'
      : 'removeEventListener'

    window[action]('resize', resizeFrame)

    return instance
  }
}
