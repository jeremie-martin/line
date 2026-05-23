Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e = {}) {
  var t = e.dangerouslyUseGlobalCSS;
  var n = t !== undefined && t;
  var r = e.productionPrefix;
  var i = r === undefined ? "jss" : r;
  var a = /([[\].#*$><+~=|^:(),"'`\s])/g;
  var s = 0;
  if (typeof window != "undefined" && i === "jss" && (o += 1) > 2) {
    console.error(["Material-UI: we have detected more than needed creation of the class name generator.", "You should only use one class name generator on the client side.", "If you do otherwise, you take the risk to have conflicting class names in production."].join("\n"));
  }
  return function (e, t) {
    s += 1;
    if (n) {
      if (t && t.options.classNamePrefix) {
        var r = t.options.classNamePrefix;
        if ((r = r.replace(a, "-")).match(/^Mui/)) {
          return r + "-" + e.key;
        }
        0;
      }
      return "" + i + s;
    }
    return "" + i + s;
  };
};
var r;
var i = require("./14.js");
if (r = i) {
  r.__esModule;
}
var o = 0;