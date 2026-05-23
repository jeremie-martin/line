var r = require("./30.js");
var i = require("./183.js");
var o = require("./53.js");
var a = require("./101.js");
var s = require("./264.js");
function l(e, t, n) {
  var u;
  var c;
  var d;
  var f;
  var p = e & l.F;
  var h = e & l.G;
  var m = e & l.S;
  var y = e & l.P;
  var g = e & l.B;
  var v = h ? r : m ? r[t] ||= {} : (r[t] || {}).prototype;
  var b = h ? i : i[t] ||= {};
  var _ = b.prototype ||= {};
  if (h) {
    n = t;
  }
  for (u in n) {
    d = ((c = !p && v && v[u] !== undefined) ? v : n)[u];
    f = g && c ? s(d, r) : y && typeof d == "function" ? s(Function.call, d) : d;
    if (v) {
      a(v, u, d, e & l.U);
    }
    if (b[u] != d) {
      o(b, u, f);
    }
    if (y && _[u] != d) {
      _[u] = d;
    }
  }
}
r.core = i;
l.F = 1;
l.G = 2;
l.S = 4;
l.P = 8;
l.B = 16;
l.W = 32;
l.U = 64;
l.R = 128;
module.exports = l;