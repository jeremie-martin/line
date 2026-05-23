exports.__esModule = true;
var r;
var i = require("./224.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
exports.default = function (e, t, n) {
  if (t in e) {
    (0, o.default)(e, t, {
      value: n,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    e[t] = n;
  }
  return e;
};