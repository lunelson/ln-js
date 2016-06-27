document.addEventListener('DOMContentLoaded', function() {

  // var lastElementClicked;
  var PrevLink = document.querySelector('a.prev');
  var NextLink = document.querySelector('a.next');

  window.Pjax = require('../../src/pjax2');
  window.Emitter = require('../../src/emitter');
  // const Dispatcher = require('../../src/dispatcher');
  // const Transition = require('../../src/pjax2-transition');

  Pjax.init();
  Pjax.Prefetch.init();

  Pjax.currTrans.on('introStart', ()=>{
    PrevLink.href = Pjax.currTrans.introData.prev;
    NextLink.href = Pjax.currTrans.introData.next;
  });


  // this.navState
  // this.actionStates
  // this.contentState
  // this.rootState
  // prevContent, newContent, prevAction, newAction
  // (oldRoot, newRoot, oldAction, newState)
  let myTrans = new Pjax.Transition((newAction, newDoc, currDoc) => {
    Promise.all(newDoc, currDoc).then(([newDoc, currDoc])=>{
      this.TL.to(newDoc, 0.25, { autoAlpha: 0 });
      this.TL.from(currDoc, 0.25, { autoAlpha: 0 });
    })
  });


  // Dispatcher.on('linkClicked', function(el) { lastElementClicked = el; });

  // // console.log(Pjax);

  // var MovePage = Pjax.Transition.extend({
  //   render() {
  //     this.originalThumb = lastElementClicked;

  //     Promise
  //       .all([this.containerLoaded, scrollTop()])
  //       .then(movePages.bind(this));
  //   }
  // });

  // Pjax.defaultTransition = MovePage;

  // function scrollTop() {
  //   var deferred = Pjax.Utils.deferred();
  //   var obj = { y: window.pageYOffset };

  //   TweenLite.to(obj, 0.4, {
  //     y: 0,
  //     onUpdate() {
  //       if (obj.y === 0) {
  //         deferred.resolve();
  //       }

  //       window.scroll(0, obj.y);
  //     },
  //     onComplete() {
  //       deferred.resolve();
  //     }
  //   });

  //   return deferred.promise;
  // }

  // function movePages() {
  //   var _this = this;
  //   var goingForward = true;

  //   if (getNewPageFile() === this.oldContainer.dataset.prev) {
  //     goingForward = false;
  //   }

  //   TweenLite.set(this.newContainer, {
  //     visibility: 'visible',
  //     xPercent: goingForward ? 100 : -100,
  //     position: 'fixed',
  //     left: 0,
  //     top: 0,
  //     right: 0
  //   });

  //   TweenLite.to(this.oldContainer, 0.6, {xPercent: goingForward ? -100 : 100});
  //   TweenLite.to(this.newContainer, 0.6, {xPercent: 0, onComplete() {
  //     TweenLite.set(_this.newContainer, {clearProps: 'all' });
  //     _this.resolve();
  //   }});
  // }

  // function updateLinks() {
  //   PrevLink.href = this.newContainer.dataset.prev;
  //   NextLink.href = this.newContainer.dataset.next;
  // }

  // function getNewPageFile () {
  //   return Pjax.HistMgr.currStatus().url.split('/').pop();
  // }

});
