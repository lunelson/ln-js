// GSAP requirements
module.exports = {
  max() {
    require('gsap/src/uncompressed/TweenMax.js');
    return this.assign();
  },
  lite() {
    require('gsap/src/uncompressed/TweenLite.js');
    require('gsap/src/uncompressed/easing/EasePack.js');
    require('gsap/src/uncompressed/plugins/CSSPlugin.js');
    return this.assign();
  },
  liteLite(){
    require('gsap/src/uncompressed/TweenLite.js');
    require('gsap/src/uncompressed/TimelineLite.js');
    require('gsap/src/uncompressed/easing/EasePack.js');
    require('gsap/src/uncompressed/plugins/CSSPlugin.js');
    return this.assign();
  },
  liteMax(){
    require('gsap/src/uncompressed/TweenLite.js');
    require('gsap/src/uncompressed/TimelineLite.js');
    require('gsap/src/uncompressed/easing/EasePack.js');
    require('gsap/src/uncompressed/plugins/CSSPlugin.js');
    return this.assign();
  },
  jquery(){
    require('gsap/src/uncompressed/jquery.gsap.js');
    return this;
  },
  draggable(){
    require('gsap/src/uncompressed/utils/Draggable.js');
    return this;
  },
  plugins(plugins){
    plugins.forEach((plugin, window)=>{
      require(`gsap/src/uncompressed/plugins/${plugin}Plugin.js`);
    });
    return this;
  },
  assign(){
    global.Tween = global.TweenMax || global.TweenLite || null;
    global.Timeline = global.TimelineMax || global.TimelineLite || null;
    return this;
  }
}
