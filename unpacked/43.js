Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isNumber = exports.isString = exports.formatMs = exports.duration = exports.easing = undefined;
o(require("./40.js"));
var r = o(require("./4.js"));
var i = o(require("./356.js"));
o(require("./14.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var a = exports.easing = {
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  easeOut: "cubic-bezier(0.0, 0, 0.2, 1)",
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
  sharp: "cubic-bezier(0.4, 0, 0.6, 1)"
};
var s = exports.duration = {
  shortest: 150,
  shorter: 200,
  short: 250,
  standard: 300,
  complex: 375,
  enteringScreen: 225,
  leavingScreen: 195
};
var l = exports.formatMs = function (e) {
  return Math.round(e) + "ms";
};
exports.isString = function (e) {
  return typeof e == "string";
};
exports.isNumber = function (e) {
  return !(0, i.default)(parseFloat(e));
};
exports.default = {
  easing: a,
  duration: s,
  create: function (e = ["all"], t = {}) {
    var n = t.duration;
    var i = n === undefined ? s.standard : n;
    var o = t.easing;
    var u = o === undefined ? a.easeInOut : o;
    var c = t.delay;
    var d = c === undefined ? 0 : c;
    (0, r.default)(t, ["duration", "easing", "delay"]);
    return (Array.isArray(e) ? e : [e]).map(function (e) {
      return e + " " + l(i) + " " + u + " " + l(d);
    }).join(",");
  },
  getAutoHeightDuration: function (e) {
    if (!e) {
      return 0;
    }
    var t = e / 36;
    return Math.round((4 + Math.pow(t, 0.25) * 15 + t / 5) * 10);
  }
};