Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.keys = undefined;
var r = o(require("./3.js"));
var i = o(require("./4.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = function (e) {
  var t = e.values;
  var n = t === undefined ? {
    xs: 0,
    sm: 600,
    md: 960,
    lg: 1280,
    xl: 1920
  } : t;
  var o = e.unit;
  var s = o === undefined ? "px" : o;
  var l = e.step;
  var u = l === undefined ? 5 : l;
  var c = (0, i.default)(e, ["values", "unit", "step"]);
  function d(e) {
    var t = typeof n[e] == "number" ? n[e] : e;
    return "@media (min-width:" + t + s + ")";
  }
  function f(e, t) {
    var r = a.indexOf(t) + 1;
    if (r === a.length) {
      return d(e);
    } else {
      return "@media (min-width:" + n[e] + s + ") and (max-width:" + (n[a[r]] - u / 100) + s + ")";
    }
  }
  return (0, r.default)({
    keys: a,
    values: n,
    up: d,
    down: function (e) {
      var t = a.indexOf(e) + 1;
      var r = n[a[t]];
      if (t === a.length) {
        return d("xs");
      }
      return "@media (max-width:" + ((typeof r == "number" && t > 0 ? r : e) - u / 100) + s + ")";
    },
    between: f,
    only: function (e) {
      return f(e, e);
    },
    width: function (e) {
      return n[e];
    }
  }, c);
};
var a = exports.keys = ["xs", "sm", "md", "lg", "xl"];