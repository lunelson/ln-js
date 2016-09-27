//  _          _      _
// | |        (_)    | |
// | |__  _ __ _  ___| | _____
// | '_ \| '__| |/ __| |/ / __|
// | |_) | |  | | (__|   <\__ \
// |_.__/|_|  |_|\___|_|\_\___/

// dependencies
var Media = require('../media/media');
var cssMedia = require('../utility/css-data').media;
var breakPoints = Media.breakPoints;


// helpers
// function runFnSeries(series) { series.forEach((fn) => fn()) }
function nodeArray(selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); }
// function zeroArray(length) { return Array.apply(null, Array(length)).map(() => 0); }
function getColumnCount() { return this.columnCounts[Media.currKey]; }
function setColumnCounts(minCellWidth) {
  var counts = Object.keys(cssMedia).reduce((obj, key) => {
    obj[key] = Math.floor(parseInt(breakPoints[key])/(minCellWidth*cssMedia[key]['html-scale']));
    return obj;
  }, {});
  return counts;
}

// ...for adding a multi-column stacking feature
function getColSpan(itemWidth, colsWidth, numCols) {
  return Math.round(itemWidth / colsWidth * numCols);
}


class Bricks {
  constructor(options){
    // super();

    this.options = Object.assign({
      parentSel: '.bricks',
      childSel: '*',
      packedAttr: 'packed',
      minCellWidth: 12,
      spacing: 2
    }, (options || {}));

    var {parentSel, childSel, packedAttr, columnCounts, minCellWidth} = this.options;

    this.packedAttr = packedAttr.indexOf('data-') === 0 ? packedAttr : `data-${ packedAttr }`;
    this.nodeSels = { all: `${parentSel} > ${childSel}`, new: `${parentSel} > ${childSel}:not([${packedAttr}])` }
    this.container = document.querySelector(parentSel);
    this.columnCounts = columnCounts || setColumnCounts(minCellWidth);
    this.container.style.position = 'relative';

    this.columnHeights;
    this.nodeHeights;
    this.columnCount;
    this.nodes;

    Media.onChange(() => { this.layout(); });
    this.layout();
  }

  layout(persist = false) {
    var remPixels = 16;
    this.nodes = nodeArray(persist ? this.nodeSels.new : this.nodeSels.all);
    this.columnCount = persist ? this.columnCount : getColumnCount.call(this);
    this.columnHeights = persist ? this.columnHeights : new Array(this.columnCount).fill(1);
    if (this.nodes.length) {

      // MEASURE
      // NB. using clientHeight here, so items must *not* have any border
      this.nodeHeights = this.nodes.map((node) => node.clientHeight);

      // MUTATE
      requestAnimationFrame(() => {
        // ? assign nodes.slice().reverse() and walk backwards through with while () loop?
        this.nodes.forEach((node, index) => {
          var nodeHeight = this.nodeHeights[index];
          // var targetHeight = this.columnHeights.reduce((currHeight, nextHeight) => { return ((currHeight - nextHeight) >= nodeHeight/2) ? nextHeight : currHeight; });
          var targetHeight = Math.min.apply(null, this.columnHeights);
          var targetIndex = this.columnHeights.indexOf(targetHeight);
          node.style.position  = 'absolute';
          node.style.top       = `${ this.columnHeights[targetIndex] }px`;
          node.style.left = `${ targetIndex * 100 / this.columnCount }%`;
          node.style.width = `${ 100 / this.columnCount }%`;
          node.setAttribute(this.packedAttr, '');
          this.columnHeights[targetIndex] += (nodeHeight + this.options.spacing * remPixels);
        });
      });
    }
  }

  update() {
    this.nodes = nodeArray(this.persist ? this.nodeSels.new : this.nodeSels.all);


  }
}

module.exports = Bricks;