# ln-js

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

