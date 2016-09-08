require('lazysizes');

// defaults
Object.assign(window.lazySizesConfig, {
  // lazyClass: 'lazy', // (default: "lazyload") // what the basic lazy class is called
  expand: 500, // (default: 360-500) // how much to expand viewport for pre-unveil loading
  minSize: 16, // (default: 40) // minimum basis to calculate sizes when data-sizes=auto
  customMedia: {}, // (default: {}) // where to put named media queries, calculated from the CSS
});

/*
OPTIONS

lazySizesConfig.lazyClass (default: "lazyload"): Marker class for all elements which should be lazy loaded (There can be only one class. In case you need to add some other element, without the defined class, simply add it per JS: $('.lazy-others').addClass('lazyload');)
lazySizesConfig.preloadAfterLoad (default: false): Whether lazysizes should load all elements after the window onload event. Note: lazySizes will then still download those not-in-view images inside of a lazy queue, so that other downloads after onload are not blocked.)
lazySizesConfig.preloadClass (default: "lazypreload"): Marker class for elements which should be lazy pre-loaded after onload. Those elements will be even preloaded, if the preloadAfterLoad option is set to false. Note: This class can be also dynamically set ($currentSlide.next().find('.lazyload').addClass('lazypreload');).
lazySizesConfig.loadingClass (default: "lazyloading"): This class will be added to img element as soon as image loading starts. Can be used to add unveil effects.
lazySizesConfig.loadedClass (default: "lazyloaded"): This class will be added to any element as soon as the image is loaded or the image comes into view. Can be used to add unveil effects or to apply styles.
lazySizesConfig.expand (default: 360-500): The expand option expands the calculated visual viewport area in all directions, so that elements can be loaded before they become visible. The default value is calculated depending on the viewport size of the device. (Note: Reasonable values are between 300 and 1000 (depending on the expFactor option.) In case you have a lot of small images or you are using the LQIP pattern you can lower the value, in case you have larger images set it to a higher value. Also note, that lazySizes will dynamically shrink this value to 0 if the browser is currently downloading, and expand it if the browser network is currently idling and the user not scrolling (by multiplying the expand option with 1.7 (expFactor)). This option can be overridden with the [data-expand] attribute.
lazySizesConfig.minSize (default: 40): For data-sizes="auto" feature. The minimum size of an image that is used to calculate the sizes attribute. In case it is under minSize the script traverses up the DOM tree until it finds a parent that is over minSize.
lazySizesConfig.srcAttr (default: "data-src"): The attribute, which should be transformed to src.
lazySizesConfig.srcsetAttr (default: "data-srcset"): The attribute, which should be transformed to srcset.
lazySizesConfig.sizesAttr (default: "data-sizes"): The attribute, which should be transformed to sizes. Makes almost only makes sense with the value "auto". Otherwise the sizes attribute should be used directly.
lazySizesConfig.customMedia (default: {}): The customMedia option object is an alias map for different media queries. It can be used to separate/centralize your multiple specific media queries implementation (layout) from the source[media] attribute (content/structure) by creating labeled media queries. (See also the custommedia extension).
*/

// allow further modification of options
module.exports = function(options) {
  Object.assign(window.lazySizesConfig, options);
}