Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, t) {
  if (e.classList) {
    e.classList.add(t);
  } else if (!(0, o.default)(e, t)) {
    if (typeof e.className == "string") {
      e.className = e.className + " " + t;
    } else {
      e.setAttribute("class", (e.className && e.className.baseVal || "") + " " + t);
    }
  }
};
var r;
var i = require("./869.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
module.exports = exports.default;