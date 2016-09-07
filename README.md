# ln-js

## re-organization !!!!

ajax/
    fetch
    pjax/
events/
    emitter
    emitter-duo
    tracker
media.js
math.js
layout/
    mason.js
graphics/
    context-plus.js
    particle.js
    point.js
    shape.js
    vector.js
    utilities.js
vendor/
    gsap/
    lazy/
    bliss
    jquery

## collision detection, Shape class

.isOutTop,-Right,-Bottom,-Left
.isTouching(shape)

## RAFwindow

make a class which can accept any element

cache:
    scrollTop
    width, height
    clientX
    clientY

emit:
    scroll
    resize
    pointer (mouse, touch)
        mouseenter
        mousemove
        mouseleave

Win = new Tracker(window);
    .scrollTop
    .dimensions
    .width
    .height
    .clientX
    .clientY

- debounce activation of a fast-as-possible function
    on event, start tracking fast as possible
        emit events
    after minTime of no events, stop

- allow both 'emit' and 'trigger'
- allow both 'one' and 'once'
- create 'request' method

request
trigger


## TODO

PJAX STUFF

- how to check if already inited, to avoid second run?
- check on popState, whether previous URL is at all from current site?
    (review History API best practices)
- write functions with destructruing
- pass clickObj..
- organize parts
    IF Trans.progress == 0
        containerLoad > (newContainer)
        (oldContainer, clickObj) > runOutro > (oldContainer)
        (newContainer, oldContainer) > swapContainersn > (newContainer)
        (newContainer) > runIntro
    ELSE IF Trans.progress < 1
        containerLoad > (newContainer)
        (oldContainer, clickObj) > goMiddle > (oldContainer)
        (newContainer, oldContainer) > swapContainersn > (newContainer)
        (newContainer) > runIntro

runOutro -- returns oldContainer, now gone
midPoint -- if past middle
                reverse and return newContainer for removal
            else
                finish outro and return oldContainer for removal
runIntro -- returns newContainer,

```js
const test = ['alpha', 'beta'];

function foo([a, b]){
  console.log(a, b);
}

foo(test);
```

OTHER JS

- promise cancelling
- bricks.js algorithm
-

, (error) => { window.location = url; console.log(error); }

/*

Transition: track newContainer and oldContainer internally
    .runOutro: return oldContainer
    .recover: return oldContainer

runOutro(oldContainer, TL, clickObj)


** change "Container" to "Content" everywhere

- discard transition promises in PJAX
- how to finish updating the page?
-


 */

