var r = require("./70.js");
var i = require("./332.js");
var o = require("./333.js");
var a = require("./71.js");
var s = require("./152.js");
var l = require("./334.js");
var u = {};
var c = {};
(exports = module.exports = function (e, t, n, d, f) {
  var p;
  var h;
  var m;
  var y;
  var g = f ? function () {
    return e;
  } : l(e);
  var v = r(n, d, t ? 2 : 1);
  var b = 0;
  if (typeof g != "function") {
    throw TypeError(e + " is not iterable!");
  }
  if (o(g)) {
    for (p = s(e.length); p > b; b++) {
      if ((y = t ? v(a(h = e[b])[0], h[1]) : v(e[b])) === u || y === c) {
        return y;
      }
    }
  } else {
    for (m = g.call(e); !(h = m.next()).done;) {
      if ((y = i(m, v, h.value, t)) === u || y === c) {
        return y;
      }
    }
  }
}).BREAK = u;
exports.RETURN = c;