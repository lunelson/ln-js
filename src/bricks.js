//  _          _      _
// | |        (_)    | |
// | |__  _ __ _  ___| | _____
// | '_ \| '__| |/ __| |/ / __|
// | |_) | |  | | (__|   <\__ \
// |_.__/|_|  |_|\___|_|\_\___/

// dependencies
// var Emitter = require('./emitter');
var Media = require('./media');
var cssMedia = require('./css-data').media;
var breakPoints = Media.breakPoints;

function fitColumns(minCellWidth) {
  var counts = Object.keys(cssMedia).reduce((obj, key) => {
    obj[key] = Math.floor(parseInt(breakPoints[key])/(minCellWidth*cssMedia[key]['html-scale']));
    return obj;
  }, {});
  return counts;
}

// helpers
function runFnSeries(series) { series.forEach((fn) => fn()) }
function nodeArray(selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); }
function zeroArray(length) { return Array.apply(null, Array(length)).map(() => 0); }

function getColumnCount() { return this.columnCounts[Media.currKey()]; }

function getColSpan(itemWidth, colsWidth, numCols) {
  return Math.round(itemWidth / colsWidth * numCols);
}


class Bricks {
  constructor(options){
    // super();

    this.options = options = Object.assign({
      parentSel: '.bricks',
      childSel: '*',
      packedAttr: 'packed',
      minCellWidth: 12,
      spacing: 2
    }, (options || {}));
    var {parentSel, childSel, packedAttr} = this.options;

    this.container = document.querySelector(parentSel);
    this.packedAttr = packedAttr.indexOf('data-') === 0 ? packedAttr : `data-${ packedAttr }`;
    this.nodeSels = { all: `${parentSel} > ${childSel}`, new: `${parentSel} > ${childSel}:not([${packedAttr}])` }
    this.nodes = nodeArray(this.persist ? this.nodeSels.new : this.nodeSels.all);
    this.columnCounts = options.columnCounts || fitColumns(options.minCellWidth);
    this.container.style.position = 'relative';
    this.columnCount;
    this.columnHeights;
    this.nodeHeights;

    Media.onChange(() => { this.layout(); });
    this.layout();
  }

  layout(persist = false) {
    var remPixels = 16;
    this.nodes = nodeArray(persist ? this.nodeSels.new : this.nodeSels.all);
    this.columnCount = persist ? this.columnCount : getColumnCount.call(this);
    this.columnHeights = persist ? this.columnHeights : zeroArray(this.columnCount);
    if (this.nodes.length) {
      this.nodeHeights = this.nodes.map((node) => node.clientHeight);
      requestAnimationFrame(() => {
        this.nodes.forEach((node, index) => {
          var nodeHeight = this.nodeHeights[index];
          // var shortestColumn = this.columnHeights.reduce((currHeight, nextHeight) => { return ((currHeight - nextHeight) >= nodeHeight/2) ? nextHeight : currHeight; });
          var shortestColumn = Math.min.apply(null, this.columnHeights);
          var targetColumn = this.columnHeights.indexOf(shortestColumn);
          node.style.position  = 'absolute';
          node.style.top       = `${ this.columnHeights[targetColumn] }px`;
          node.style.left = `${ targetColumn * 100 / this.columnCount }%`;
          node.style.width = `${ 100 / this.columnCount }%`;
          node.setAttribute(this.packedAttr, '');
          this.columnHeights[targetColumn] += nodeHeight + this.options.spacing * remPixels;
        });
      });
    }
  }

  update() {
    this.nodes = nodeArray(this.persist ? this.nodeSels.new : this.nodeSels.all);


  }
}

module.exports = Bricks;