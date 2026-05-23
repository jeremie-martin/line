var r = require("./41.js");
var i = require("./24.js");
var o = require("./70.js");
var a = require("./58.js");
function s(e, t, n) {
  var l;
  var u;
  var c;
  var d = e & s.F;
  var f = e & s.G;
  var p = e & s.S;
  var h = e & s.P;
  var m = e & s.B;
  var y = e & s.W;
  var g = f ? i : i[t] ||= {};
  var v = g.prototype;
  var b = f ? r : p ? r[t] : (r[t] || {}).prototype;
  if (f) {
    n = t;
  }
  for (l in n) {
    if (!(u = !d && b && b[l] !== undefined) || !(l in g)) {
      c = u ? b[l] : n[l];
      g[l] = f && typeof b[l] != "function" ? n[l] : m && u ? o(c, r) : y && b[l] == c ? function (e) {
        function t(t, n, r) {
          if (this instanceof e) {
            switch (arguments.length) {
              case 0:
                return new e();
              case 1:
                return new e(t);
              case 2:
                return new e(t, n);
            }
            return new e(t, n, r);
          }
          return e.apply(this, arguments);
        }
        t.prototype = e.prototype;
        return t;
      }(c) : h && typeof c == "function" ? o(Function.call, c) : c;
      if (h) {
        (g.virtual ||= {})[l] = c;
        if (e & s.R && v && !v[l]) {
          a(v, l, c);
        }
      }
    }
  }
}
s.F = 1;
s.G = 2;
s.S = 4;
s.P = 8;
s.B = 16;
s.W = 32;
s.U = 64;
s.R = 128;
module.exports = s;