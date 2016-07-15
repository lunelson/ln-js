var $ = module.exports = require('jquery');

/////////////////////////////////////////
// transition and animation end events //
/////////////////////////////////////////

  var Prefixed = require('../src/prefixed.js');
  var transEnd = Prefixed.transEnd;
  var animEnd = Prefixed.animEnd;

  $.fn.onTransEnd = function(fn){ return this.on(transEnd, fn); };
  $.fn.oneTransEnd = function(fn){ return this.one(transEnd, fn); };
  $.fn.transEnd = function(fn){ var end = new $.Deferred(); this.on(transEnd, end.resolve); return end; };

  $.fn.onAnimEnd = function(fn){ return this.on(animEnd, fn); };
  $.fn.oneAnimEnd = function(fn){ return this.one(animEnd, fn); };
  $.fn.animEnd = function(fn){ var end = new $.Deferred(); this.on(animEnd, end.resolve); return end; };

///////////////
// box model //
///////////////

  $.boxModel = 'border-box';
  $.fn.boxHeight = function(boxModel){
    boxModel = boxModel || $.boxModel;
    boxModel = (boxModel == 'auto')?this.css('box-sizing'):boxModel;
    if (this.length) {
      switch (boxModel) {
        case 'content-box':
        return this.eq(0).height();
        case 'padding-box':
        // return this.eq(0).innerHeight();
        return this.get(0).clientHeight;
        case 'border-box':
        // return this.eq(0).outerHeight();
        return this.get(0).offsetHeight;
        case 'margin-box':
        return this.eq(0).outerHeight(true);
      }
    }
  };
  $.fn.boxWidth = function(boxModel){
    boxModel = boxModel || $.boxModel;
    boxModel = (boxModel == 'auto')?this.css('box-sizing'):boxModel;
    if (this.length) {
      switch (boxModel) {
        case 'content-box':
        return this.eq(0).width();
        case 'padding-box':
        // return this.eq(0).innerWidth();
        return this.get(0).clientWidth;
        case 'border-box':
        // return this.eq(0).outerWidth();
        return this.get(0).offsetWidth;
        case 'margin-box':
        return this.eq(0).outerWidth(true);
      }
    }
  };
  $.fn.boxHeights = function(){ return this.map(function(index, elem){ return $(elem).boxHeight(); }); };
  $.fn.boxWidths = function(){ return this.map(function(index, elem){ return $(elem).boxWidth(); }); };
  $.fn.maxBoxHeight = function(){ return Math.max.apply(Math, this.boxHeights().get() ); };
  $.fn.minBoxHeight = function(){ return Math.min.apply(Math, this.boxHeights().get() ); };
  $.fn.maxBoxWidth = function(){ return Math.max.apply(Math, this.boxWidths().get() ); };
  $.fn.minBoxWidth = function(){ return Math.min.apply(Math, this.boxWidths().get() ); };
