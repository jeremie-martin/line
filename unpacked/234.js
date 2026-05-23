Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./121.js");
var o = "";
var a = "";
if (((r = i) && r.__esModule ? r : {
  default: r
}).default) {
  var s = {
    Moz: "-moz-",
    ms: "-ms-",
    O: "-o-",
    Webkit: "-webkit-"
  };
  var l = document.createElement("p").style;
  for (var u in s) {
    if (u + "Transform" in l) {
      o = u;
      a = s[u];
      break;
    }
  }
}
exports.default = {
  js: o,
  css: a
};