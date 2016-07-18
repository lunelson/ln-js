let win = new Emitter();
let resizeRequested = false;
let scrollRequested = false;

window.addEventListener('resize', (event) => {
  if (!resizeRequested) {
    resizeRequested = true;
    window.requestAnimationFrame((hrTimeStamp) => {
      win.emit('resize', event);
      resizeRequested = false;
    })
  }
})

window.addEventListener('scroll', (event) => {
  if (!scrollRequested) {
    scrollRequested = true;
    window.requestAnimationFrame((hrTimeStamp) => {
      win.emit('scroll', event);
      scrollRequested = false;
    })
  }
})

function onScroll(){
  if (pendingAnimationFrame) return;
  pendingAnimationFrame = true;
  requestAnimationFrame((hrTimeStamp)=>{
    // do something;
    pendingAnimationFrame = false;
  })
}



/*

Win.onResize
Win.onScroll

measure
mutate

Device.onResize(measure, mutate) {

 */}
