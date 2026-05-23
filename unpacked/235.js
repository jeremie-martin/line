Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = h(require("./3.js"));
var i = h(require("./4.js"));
var o = h(require("./162.js"));
h(require("./14.js"));
var a = h(require("./713.js"));
var s = h(require("./122.js"));
var l = h(require("./714.js"));
var u = h(require("./715.js"));
var c = h(require("./716.js"));
var d = h(require("./43.js"));
var f = h(require("./719.js"));
var p = h(require("./720.js"));
function h(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = function (e = {}) {
  var t = e.palette;
  var n = t === undefined ? {} : t;
  var h = e.breakpoints;
  var m = h === undefined ? {} : h;
  var y = e.mixins;
  var g = y === undefined ? {} : y;
  var v = e.typography;
  var b = v === undefined ? {} : v;
  var _ = e.shadows;
  var w = (0, i.default)(e, ["palette", "breakpoints", "mixins", "typography", "shadows"]);
  var x = (0, l.default)(n);
  var E = (0, s.default)(m);
  return (0, r.default)({
    direction: "ltr",
    palette: x,
    typography: (0, a.default)(x, b),
    mixins: (0, u.default)(E, p.default, g),
    breakpoints: E,
    shadows: _ || c.default
  }, (0, o.default)({
    transitions: d.default,
    spacing: p.default,
    zIndex: f.default
  }, w));
};