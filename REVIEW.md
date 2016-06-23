ClassObj
    class: class {}
    mixin: function {}

Media // extend Emitter
    on
    one
    off
    trigger
    ---
    getCSS
    onChange
    onBelow
    onAbove
    breakPoints

Cache
    data: Object
    active: Boolean // add this
    ---
    get // if !this.active, return null
    set // if !this.active, noop()
    reset // if !this.active, noop()

Gsap // add require check
    max
    lite
    liteLite
    liteMax
    jquery
    draggable
    plugins([...])

Ajax
    get
    getJSON

Emitter
    on
    one
    off
    trigger

Dispatcher // extends Emitter

HistMgr
    history
    ---
    push
    lastStatus
    prevStatus

Utils
    getHTML
    currUrl
    cleanHref
    validLink
    getPort

Transition
    outroFn
    outroTl
    outroRun
    outroContent
    outroData
    ---
    (constructor)
    progress
    runOutro
    recover
    makeTL

Dom
    dataNamespace // rename: namespaceAttr
    wrapperId
    spinnerId // add
    containerClass
    ---
    updateTitle(titleEl)
        - set current title based on input
    updateWrapper
        - run queued callbacks for this
    parseNewContainer(responseText) // rename: processResponse
        - get response from Ajax.get, put in temp div
        - parse <title> from temp, pass to this.updateTitle
        - fire callback to update wrapper
        - parse <wrapper> from temp, and pass to setContainer
    currWrapper // rename: parseWrapper(html)
        - set this.wrapper to #pjax-wrapper or #pjax or body
    currContainer(wrapper) // rename: parseContainer(wrapper)
        - set this.currContainer

Pjax // extend Emitter
    (events)
    click
    domUpdate
    stateChange
    ---
    wrapper
    spinner
    currContainer
    currTransition
    updateTransition(clickObj) -> set and return currTransition, according to clickObj
    currWrapper // remove
    cacheEnabled // remove
    lastClicked // remove
    ---
    (init)
        - Dom.parseWrapper()
        - Dom.parseContainer(this.wrapper)
    activeTransition // remove


    setCurrTrans // remove
    loadNewContainer // rename: getNewContainer
        - this.getContent -> response
        - Dom.processResponse -> container
        -

    handleClick(event)
    handleStateChange(clickObj)
    handleDomUpdate(title, container)
    swapAndUpdate // rename: updateDom([newContainer, oldContainer])
    endTransition


window.click -> triggerClick
    - parse element out of event
    - if valid element.href and not equal to Hist.curr.url
        - Hist.add(clickObj)//
        - window.history.pushState
        - this.trigger('stateChange', Hist.curr(), Hist.prev())//
        - this.trigger('stateChange', clickObj, Hist.curr())

window.popstate -> triggerPopState
    - this.trigger('stateChange', Hist.prev(), Hist.curr())
    - Hist.add(Hist.prev());



