exports.__esModule = true;
var r;
var i = require("./321.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
exports.default = o.default || function (e) {
  for (var t = 1; t < arguments.length; t++) {
    var n = arguments[t];
    for (var r in n) {
      if (Object.prototype.hasOwnProperty.call(n, r)) {
        e[r] = n[r];
      }
    }
  }
  return e;
};