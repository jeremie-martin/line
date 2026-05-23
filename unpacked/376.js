Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e) {
  if ((!a && a !== 0 || e) && o.default) {
    var t = document.createElement("div");
    t.style.position = "absolute";
    t.style.top = "-9999px";
    t.style.width = "50px";
    t.style.height = "50px";
    t.style.overflow = "scroll";
    document.body.appendChild(t);
    a = t.offsetWidth - t.clientWidth;
    document.body.removeChild(t);
  }
  return a;
};
var r;
var i = require("./166.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
var a = undefined;
module.exports = exports.default;