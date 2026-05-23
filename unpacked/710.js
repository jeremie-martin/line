Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e) {
  if (!s) {
    return e;
  }
  if (l[e] != null) {
    return l[e];
  }
  if ((0, o.default)(e) in s.style) {
    l[e] = e;
  } else if (i.default.js + (0, o.default)("-" + e) in s.style) {
    l[e] = i.default.css + e;
  } else {
    l[e] = false;
  }
  return l[e];
};
var r = a(require("./121.js"));
var i = a(require("./234.js"));
var o = a(require("./711.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var s = undefined;
var l = {};
if (r.default) {
  s = document.createElement("p");
  var u = window.getComputedStyle(document.documentElement, "");
  for (var c in u) {
    if (!isNaN(c)) {
      l[u[c]] = u[c];
    }
  }
}