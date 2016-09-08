//   ___  _
//  / _ \(_)
// / /_\ \_  __ ___  __
// |  _  | |/ _` \ \/ /
// | | | | | (_| |>  <
// \_| |_/ |\__,_/_/\_\
//      _/ |
//     |__/

const Ajax = {

  get(url){
    var req = new XMLHttpRequest();
    return new Promise((resolve, reject) => {
       req.ontimeout = () => reject(new Error('Ajax.get: Timeout exceeded'));
       req.onreadystatechange = () => {
        if (req.readyState === 4) {
          if (req.status != 200) return reject(new Error('Ajax.get: HTTP code is not 200'));
          resolve(req.responseText);
        }
      };
      req.open('GET', url);
      req.setRequestHeader('x-pjax', 'yes');
      req.timeout = 5000;
      req.send();
    });
  },

};

module.exports = Ajax;