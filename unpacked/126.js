exports.__esModule = true;
var r;
var i = require("./739.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
exports.default = function (e) {
  if (Array.isArray(e)) {
    for (var t = 0, n = Array(e.length); t < e.length; t++) {
      n[t] = e[t];
    }
    return n;
  }
  return (0, o.default)(e);
};