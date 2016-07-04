

/* how to set and choose transition */

Pjax.setTransition((url)=>{/* return Transition wrt URL */})

Pjax.prevContainer;
Pjax.currContainer;
Pjax.setContainer(html) // if no HTML, use document.body
Pjax.prevTransition
Pjax.currTransition
Pjax.setTransition(url) // if no URL, return current transition

//-----------

const myTrans = new Pjax.Transition({
  render(oldContainer, clickObj, docLoadPromise){/* use this.timeline */},
  recover(){/* use this.timeline */},
});

Pjax.setTransition = (url) => {

}

var Gsap = require('./gsap');
Gsap.init('liteLite'); // do not init more than once
var myTween = new Gsap.Tween();
var myTimeline = new Gsap.Timeline();

const myTrans = new Pjax.Transition((transTimeline, oldContainer, clickObj, docLoadPromise) => {

})

/*===================================*/

