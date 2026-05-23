Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./40.js"));
var i = a(require("./3.js"));
a(require("./14.js"));
var o = a(require("./162.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = function (e) {
  var t = typeof e == "function";
  return {
    create: function (n, a) {
      var s = t ? e(n) : e;
      if (!n.overrides || !a || !n.overrides[a]) {
        return s;
      }
      var l = n.overrides[a];
      var u = (0, i.default)({}, s);
      (0, r.default)(l).forEach(function (e) {
        u[e] = (0, o.default)(u[e], l[e]);
      });
      return u;
    },
    options: {},
    themingEnabled: t
  };
};