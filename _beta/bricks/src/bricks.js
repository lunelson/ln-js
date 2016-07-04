import knot from 'knot.js'

export default (options = {}) => {
  // globals

  let persist           // updating or packing all elements?
  let ticking           // for debounced resize

  let sizeInfoIndex
  let sizeInfo

  let colHeights

  let nodes
  let nodesWidth
  let nodesHeights

  // options

  // what is this, if the options are empty? should it have a default?
  const container = document.querySelector(options.container)
  // make sure `packed` has 'data-' prefix
  const packed    = options.packed.indexOf('data-') === 0 ? options.packed : `data-${ options.packed }`
  // make a copy of sizes array, reversed
  const sizes     = options.sizes.slice().reverse()
  // sounds like 'packed' is a way of not affecting certain elements
  const selectors = {
    all: `${ options.container } > *`,
    new: `${ options.container } > *:not([${ packed }])`
  }

  // series

  const setup = [
    setSizeIndex,
    setSizeDetail,
    zeroColumnHeights
  ]

  const run = [
    setNodes,
    measureNodes,
    mutateNodes,
    mutateContainer
  ]

  // instance
  // will have pack, update and resize methods, in addition to knot methods
  const instance = knot({
    pack,
    update,
    resize
  })

  return instance

  // general helpers

  function runSeries(functions) {
    functions.forEach((func) => func())
  }

  // array helpers

  function toArray(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector))
  }

  function fillArray(length) {
    return Array.apply(null, Array(length)).map(() => 0)
  }

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

  function zeroColumnHeights() {
    colHeights = fillArray(sizeInfo.columns)
  }

  // node helpers

  function setNodes() {
    nodes = toArray(persist ? selectors.new : selectors.all)
  }

  function measureNodes() {
    if(nodes.length === 0) {
      return
    }

    nodesWidth   = nodes[0].clientWidth //??
    nodesHeights = nodes.map((element) => element.clientHeight)
  }

  function mutateNodes() {
    nodes.forEach((node, nodeIndex) => {
      const nodeHeight = nodeHeights[nodeIndex];
      const colIndex = colHeights.indexOf(colHeights.reduce((currHeight, nextHeight) => (currHeight - nextHeight) >= nodeHeight/2 ? nextHeight : currHeight));

      node.style.position  = 'absolute'
      node.style.top       = `${ colHeights[colIndex] }px`
      node.style.left      = `${ (colIndex * nodesWidth) + (colIndex * sizeInfo.gutter) }px`

      node.setAttribute(packed, '')

      colHeights[colIndex] += nodesHeights[nodeIndex] + sizeInfo.gutter
    })
  }

  // container helpers

  function mutateContainer() {
    container.style.position = 'relative'
    container.style.width    = `${ sizeInfo.columns * nodesWidth + (sizeInfo.columns - 1) * sizeInfo.gutter }px`
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
    runSeries(setup.concat(run)) // do setup, and run series

    return instance.emit('pack')
  }

  function update() {
    persist = true // causes only unpacked to pack
    runSeries(run) // do only run series

    return instance.emit('update')
  }

  function resize(flag = true) {
    const action = flag
      ? 'addEventListener'
      : 'removeEventListener'

    window[action]('resize', resizeFrame)

    return instance
  }
}
