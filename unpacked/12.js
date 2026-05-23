exports.__esModule = true;
var r;
var i = require("./155.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
exports.default = function (e, t) {
  if (!e) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }
  if (!t || (t === undefined ? "undefined" : (0, o.default)(t)) !== "object" && typeof t != "function") {
    return e;
  } else {
    return t;
  }
};