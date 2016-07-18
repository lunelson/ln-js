let win = new Emitter();
let resizeRequested = false;
let scrollRequested = false;

window.addEventListener('resize', (event) => {
  if (!resizeRequested) {
    resizeRequested = true;
    window.requestAnimationFrame((hiResTime) => {
      win.emit('resize', event);
      resizeRequested = false;
    })
  }
})

window.addEventListener('scroll', (event) => {
  if (!scrollRequested) {
    scrollRequested = true;
    window.requestAnimationFrame((hiResTime) => {
      win.emit('scroll', event);
      scrollRequested = false;
    })
  }
})

function onScroll(){
  if (pendingAnimationFrame) return;
  pendingAnimationFrame = true;
  requestAnimationFrame((hiResTime)=>{
    // do something;
    pendingAnimationFrame = false;
  })
}

requestAnimationFrame(() => {
  requestAnimationFrame(self);
  if (trackingScroll) tracker.emit('scroll');
  if (trackingResize) tracker.emit('resize');
});

/*

Win.onResize
Win.onScroll

measure
mutate

Device.onResize(measure, mutate) {

 */}

/*

Win.onResize
Win.onScroll

measure
mutate

Device.onResize(measure, mutate) {

 */}

const debounce = require('lodash.debounce');

const scrollEmitter = debounce(() => {
  console.log('toggling scroll tracking');
}, 100, {leading: true, trailing: true});

const resizeEmitter = debounce(() => {
  console.log('toggling resize tracking');
}, 100, {leading: true, trailing: true});

window.addEventListener('scroll', scrollEmitter);
window.addEventListener('resize', resizeEmitter);