var r = require("./267.js");
var i = Math.min;
module.exports = function (e) {
  if (e > 0) {
    return i(r(e), 9007199254740991);
  } else {
    return 0;
  }
};