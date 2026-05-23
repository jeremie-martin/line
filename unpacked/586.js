var r = require("./303.js");
var i = Infinity;
var o = 1.7976931348623157e+308;
module.exports = function (e) {
  if (e) {
    if ((e = r(e)) === i || e === -i) {
      return (e < 0 ? -1 : 1) * o;
    } else if (e == e) {
      return e;
    } else {
      return 0;
    }
  } else if (e === 0) {
    return e;
  } else {
    return 0;
  }
};