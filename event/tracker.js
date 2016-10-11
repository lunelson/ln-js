/*
- add this as reference for track-window
    https://github.com/christinecha/choreographer-js/blob/master/src/Animation.js
 */
const Emitter = require('./emitter');
const throttle = require('../lib/throttle');

class Tracker extends Emitter {
  constructor(element) {

    super();
    this.scrollTop = 0;
    this.width = element.offsetWidth;
    this.height = element.offsetHeight;
    this.resizePending = false;
    this.scrollPending = false;

    this.scrollFns = {};
    this.resizeFns = {};

    element.addEventListener('resize', throttle(() => {
      // TODO: update resize dependent stuff here
      this.trigger('resize', {/* relevant information in here*/});
    }, 1000 / 60));

    element.addEventListener('scroll', throttle(() => {
      // TODO: update scroll dependent stuff here
      this.trigger('scroll', {/* relevant information in here*/});
    }, 1000 / 60));

    // element.addEventListener('resize', (event) => {
    //   if (!this.resizePending) {
    //     this.resizePending = true;
    //     window.requestAnimationFrame(() => {
    //       this.trigger('resize', event);
    //       this.resizePending = false;
    //     })
    //   }
    // })

    // element.addEventListener('scroll', (event) => {
    //   if (!this.scrollPending) {
    //     this.scrollPending = true;
    //     window.requestAnimationFrame(() => {
    //       this.trigger('scroll', event);
    //       this.scrollPending = false;
    //     })
    //   }
    // })

  }

  // onResize(measure, mutate) {
  //   const id = Date.now();
  //   this.scrollFns[id] = false;
  //   this.on('resize', () => {
  //     measure && measure();
  //     if (mutate && !this.scrollFns[id]) {
  //       this.scrollFns[id] = true;
  //       requestAnimationFrame(mutate);
  //     }
  //   });
  //   return id;
  // }


  onScroll(measure, mutate) {
    mutate && (mutate._pending = false);
    const id = Date.now();
    const scrollFn = ({/* receive data*/}) => {
      measure && measure();
      if (mutate && !mutate._pending) {
        mutate._pending = true;
        requestAnimationFrame(() => {
          mutate(); mutate._pending = false;
        });
      }
    };
    this.scrollFns[id] = scrollFn;
    this.on('scroll', scrollFn);
    return id;
  }

  offScroll(id) { this.off('scroll', this.scrollFns[id]); }

  onResize(measure, mutate) {
    mutate && (mutate._pending = false);
    const id = Date.now();
    const resizeFn = () => {
      measure && measure();
      if (mutate && !mutate._pending) {
        mutate._pending = true;
        requestAnimationFrame(() => {
          mutate(); mutate._pending = false;
        });
      }
    };
    this.resizeFns[id] = resizeFn;
    this.on('resize', resizeFn);
    return id;
  }

  offResize(id) { this.off('resize', this.resizeFns[id]); }
}

// const emitter = new Emitter();

// let pendingResize = false;
// let pendingScroll = false;

// let scrollTop, width, height;

// window.addEventListener('resize', (event) => {
//   if (!pendingResize) {
//     pendingResize = true;
//     window.requestAnimationFrame((hiResTime) => {
//       emitter.trigger('resize', event);
//       pendingResize = false;
//     })
//   }
// })

// window.addEventListener('scroll', (event) => {
//   if (!pendingScroll) {
//     pendingScroll = true;
//     window.requestAnimationFrame((hiResTime) => {
//       emitter.trigger('scroll', event);
//       pendingScroll = false;
//     })
//   }
// })

module.exports = Tracker;