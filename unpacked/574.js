var r = require("./575.js");
var i = require("./576.js");
var o = require("./585.js");
var a = Math.ceil;
var s = Math.max;
module.exports = function (e, t, n) {
  t = (n ? i(e, t, n) : t === undefined) ? 1 : s(o(t), 0);
  var l = e == null ? 0 : e.length;
  if (!l || t < 1) {
    return [];
  }
  for (var u = 0, c = 0, d = Array(a(l / t)); u < l;) {
    d[c++] = r(e, u, u += t);
  }
  return d;
};