//  _____ _ _      _   ___  ___
// /  __ \ (_)    | |  |  \/  |
// | /  \/ |_  ___| | _| .  . | __ _ _ __
// | |   | | |/ __| |/ / |\/| |/ _` | '__|
// | \__/\ | | (__|   <| |  | | (_| | |
//  \____/_|_|\___|_|\_\_|  |_/\__, |_|
//                              __/ |
//                             |___/

const Clicks = {
  stamps: [],
  clicks: [],
  prev: null,
  curr: 0,
  next: null,
  push(obj){
    this.clicks.push(obj);
    this.stamps.push(obj.stamp);
  },
  popTo(obj){
    let n = this.stamps.indexOf(obj.stamp);
    this.curr = this.clicks[n];
    this.next = (clicks.length > (n + 2)) ? this.clicks[n + 1]
  },
  slice(index){}
}

function timestamp(){
  var date = new Date();
  return [
      date.getYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds()
  ].join('');
}

module.exports = Clicks;
