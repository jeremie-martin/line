var r = require("./218.js");
var i = Math.max;
var o = Math.min;
module.exports = function (e, t) {
  if ((e = r(e)) < 0) {
    return i(e + t, 0);
  } else {
    return o(e, t);
  }
};