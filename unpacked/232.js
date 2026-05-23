Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, t, n = {}) {
  var r = "";
  if (!t) {
    return r;
  }
  var i = n.indent;
  var s = i === undefined ? 0 : i;
  var l = t.fallbacks;
  s++;
  if (l) {
    if (Array.isArray(l)) {
      for (var u = 0; u < l.length; u++) {
        var c = l[u];
        for (var d in c) {
          var f = c[d];
          if (f != null) {
            r += "\n" + a(d + ": " + (0, o.default)(f) + ";", s);
          }
        }
      }
    } else {
      for (var p in l) {
        var h = l[p];
        if (h != null) {
          r += "\n" + a(p + ": " + (0, o.default)(h) + ";", s);
        }
      }
    }
  }
  for (var m in t) {
    var y = t[m];
    if (y != null && m !== "fallbacks") {
      r += "\n" + a(m + ": " + (0, o.default)(y) + ";", s);
    }
  }
  if (r || n.allowEmpty) {
    return r = a(e + " {" + r + "\n", --s) + a("}", s);
  } else {
    return r;
  }
};
var r;
var i = require("./160.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
function a(e, t) {
  var n = "";
  for (var r = 0; r < t; r++) {
    n += "  ";
  }
  return n + e;
}