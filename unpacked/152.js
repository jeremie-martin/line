var r = require("./218.js");
var i = Math.min;
module.exports = function (e) {
  if (e > 0) {
    return i(r(e), 9007199254740991);
  } else {
    return 0;
  }
};