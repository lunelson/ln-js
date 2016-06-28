//  _   _             _____ _             _
// | \ | |           /  ___| |           | |
// |  \| | __ ___   _\ `--.| |_ __ _  ___| | __
// | . ` |/ _` \ \ / /`--. \ __/ _` |/ __| |/ /
// | |\  | (_| |\ V //\__/ / || (_| | (__|   <
// \_| \_/\__,_| \_/ \____/ \__\__,_|\___|_|\_\

// TODO: change the name of this to StateStack

class NavStack {

  constructor() {
    this.keys = [];
    this.vals = [];
    this.index = -1;
  }

  push(key, val) {
    this.keys = this.keys.slice(this.index - 1);
    this.vals = this.vals.slice(this.index - 1);
    this.index = this.keys.push(key) - 1; // index = length - 1
    return this.vals.push(val); // length returned
  }

  seek(key) { this.index = this.keys.indexOf(key); return this.curr(); }

  goto(n) { this.index = n; return this.curr(); }

  go(n) { this.index += n; return this.curr(); }

  curr() { return this.vals[this.index] || null; }

  prev() { return this.vals[this.index - 1] || null; }

  next() { return this.vals[this.index + 1] || null; }

  get length() { return this.vals.length; }
}

module.exports = NavStack;