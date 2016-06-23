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
  push(obj){},
  pop(){},
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
