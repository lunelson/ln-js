
class Bricks extends Emitter {
  constructor(containerSel){
    super();
    this.nodes;
    this.columnCount;
    this.columnHeights;
    this.nodeHeights;

    measure() {
      if (this.nodes.length === 0) return;
      // nodeWidth = this.nodes[0].clientWidth;
      this.nodeHeights = this.nodes.map((node) => node.clientHeight);
    }

    mutate() {
      this.nodes.forEach((node, index) => {
        var nodeHeight = this.nodeHeights[index];
        var targetColumn = this.columnHeights.indexOf(this.columnHeights.reduce((currHeight, nextHeight) => {
          return (currHeight - nextHeight) >= nodeHeight/2 ? nextHeight : currHeight;
        }));

        node.style.position  = 'absolute';
        node.style.top       = `${ this.columnHeights[targetColumn] }px`;
        // TODO: make the left style percentage based; eliminate horizontal gutter
        node.style.left      = `${ (targetColumn * nodeWidth) + (targetColumn * sizeInfo.gutter) }px`;

        node.setAttribute(packed, '');
        this.columnHeights[targetColumn] += this.nodeHeights[index] + sizeInfo.gutter;
      });
    }

  }

}