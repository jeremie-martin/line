Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = l(require("./981.js"));
var i = l(require("./982.js"));
var o = l(require("./983.js"));
var a = l(require("./984.js"));
var s = l(require("./985.js"));
function l(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var u = {
  "@charset": r.default,
  "@import": r.default,
  "@namespace": r.default,
  "@keyframes": i.default,
  "@media": o.default,
  "@supports": o.default,
  "@font-face": a.default,
  "@viewport": s.default,
  "@-ms-viewport": s.default
};
exports.default = Object.keys(u).map(function (e) {
  var t = new RegExp("^" + e);
  return {
    onCreateRule: function (n, r, i) {
      if (t.test(n)) {
        return new u[e](n, r, i);
      } else {
        return null;
      }
    }
  };
});