module.exports = {
  click(){},
  popState(){},
  pjaxStateChange(clickObj){

    // start new document load
    const newDocumentLoad = loadNewDocument(clickObj.url);

    // setup and start/recover outgoing transition
    let outgoingTransition;
    if (currContainerTransition.progress == 0) { // has been reset, or never run
      this.setContainerTrans(clickObj);
      this.one('domChange', pjaxDomChange);
      outgoingTransition = this.currContainerTrans.outro(this.currContainerEl); // nb executed
    } else {
      this.off('domChange', pjaxDomChange);
      outgoingTransition = this.currContainerTrans.recover();
    }

    // chain to document updates and incoming container transition
    return Promise.all(newDocumentLoad, outgoingTransition)
      .then((results)=>this.trigger('domChange', ...results))
      .then(udpateCurrDocument) // receive [newDocumentHTML, oldContainerEl]
          // - set document.title
          // - history.pushState(clickObj, title, clickObj.url)
          // - Clicks.push(clickObj)
          //     - if Clicks.find(ClickObj.stamp) Clicks.trim(index)
      .then(this.currContainerTrans.intro); // receive newContainerEl
  },
  pjaxDomChange(newDocumentHTML, oldContainerEl){

  },
};