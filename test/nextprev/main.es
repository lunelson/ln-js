document.addEventListener('DOMContentLoaded', function() {

  var lastElementClicked;
  var PrevLink = document.querySelector('a.prev');
  var NextLink = document.querySelector('a.next');

  var Pjax = require('../../src/Pjax');
  var Dispatcher = require('../../src/Dispatcher');

  Pjax.init();
  Pjax.Prefetch.init();

  Dispatcher.on('linkClicked', function(el) {
    lastElementClicked = el;
  });

  // console.log(Pjax);

  var MovePage = Pjax.Transition.extend({
    render() {
      this.originalThumb = lastElementClicked;

      Promise
        .all([this.containerLoaded, scrollTop()])
        .then(movePages.bind(this));
    }
  });

  Pjax.defaultTransition = MovePage;

  function scrollTop() {
    var deferred = Pjax.Utils.deferred();
    var obj = { y: window.pageYOffset };

    TweenLite.to(obj, 0.4, {
      y: 0,
      onUpdate() {
        if (obj.y === 0) {
          deferred.resolve();
        }

        window.scroll(0, obj.y);
      },
      onComplete() {
        deferred.resolve();
      }
    });

    return deferred.promise;
  }

  function movePages() {
    var _this = this;
    var goingForward = true;
    PrevLink.href = this.newContainer.dataset.prev;
    NextLink.href = this.newContainer.dataset.next;

    if (getNewPageFile() === this.oldContainer.dataset.prev) {
      goingForward = false;
    }

    TweenLite.set(this.newContainer, {
      visibility: 'visible',
      xPercent: goingForward ? 100 : -100,
      position: 'fixed',
      left: 0,
      top: 0,
      right: 0
    });

    TweenLite.to(this.oldContainer, 0.6, {xPercent: goingForward ? -100 : 100});
    TweenLite.to(this.newContainer, 0.6, {xPercent: 0, onComplete() {
      TweenLite.set(_this.newContainer, {clearProps: 'all' });
      _this.resolve();
    }});
  }

  function updateLinks() {
    PrevLink.href = this.newContainer.dataset.prev;
    NextLink.href = this.newContainer.dataset.next;
  }

  function getNewPageFile () {
    return Pjax.History.currentStatus().url.split('/').pop();
  }

});
