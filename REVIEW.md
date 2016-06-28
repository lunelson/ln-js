Gsap // add require check
    max
    lite
    liteLite
    liteMax
    jquery
    draggable
    plugins([...])

// TODO: read up about es6 mixins
ClassObj
    class: class {}
    mixin: function {}

Ajax // use / polyfill the Fetch API
    get
    getJSON

Emitter
    on
    one
    off // what happens if you try to off() soemthing that's not listening
    trigger

//====================================

Prefetch
    active: Boolean
    listeners
    --
    init
        - addEventListeners:
    linkTest(link)
        - validate link for prefetc
    setLinkTest(fn)
        - this.linkTest
    isValid(link)
        - return Pjax.linkTest(link) && this.linkTest(link)

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
    <!-- global listeners -->
    click
    popState
    <!-- internal events, listeners -->
    domUpdate
    stateChange
    <!-- properties -->
    wrapperEl: Node
    spinnerEl: Node
    currContainerEl: Node
    currSpinnerTrans: Object
    currContainerTrans: Object
    <!-- methods -->
    setSpinnerTrans(clickObj) // can be reset
        - set and return spinnerTransition
    setContainerTrans(clickObj) // can be reset
        - set and return containerTransition
    testLink(link)
        - validate link for pjax
    loadNewDocument(url)
    updateCurrDocument([newDocumentHTML, oldContainerEl])
    init
        - Dom.parseWrapper()
        - Dom.parseContainer(this.wrapper)
    <!-- Handlers: global -->
    click(event)
        - validate link; if valid
            - compare url to window.location.href; if different
                - stop propagation etc.
                - trigger this.stateChange, clickObj, Clicks.curr()
    popState(event)
        - clickObj = Clicks.find(window.state.stamp)
        - trigger this.stateChange, clickObj, Clicks.curr()
    <!-- Handlers: internal -->
    pjaxStateChange(clickObj)
        - var newDocumentLoad = loadNewDocument(clickObj)
        - if currContainerTransition.progress == 0 // has been reset, or never run
            this.currContainerTrans = this.setCurrTrans(clickObj.url)
            var outgoingTransition = this.currContainerTrans.doOutgoing(); // nb executed
            Promise.all(newDocumentLoad, outgoingTransition)
            .then(udpateCurrDocument) // receive [newDocumentHTML, oldContainerEl]
                - set document.title
                - history.pushState(clickObj, title, clickObj.url)
                - Clicks.push(clickObj)
                    - if Clicks.find(ClickObj.stamp) Clicks.trim(index)
            .then(this.currContainerTrans.doIncoming)
        - else
            var outgoingTransition = this.currContainerTrans.recover();
            var transIncoming = this.currContainerTrans.intro
transOut
transIn
recover



    setCurrTrans // remove
    loadNewContainer // rename: loadNewDocument
        - this.getContent -> response
        - Dom.processResponse -> container
        -

    handleClick(event)
    handlePopState(event)
    --
    handlePjaxStateChange(clickObj)
    handlePjaxDomUpdate(title, container)
    swapAndUpdate // rename: updateDom([newContainer, oldContainer])
    endTransition

