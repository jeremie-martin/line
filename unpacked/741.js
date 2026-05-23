var r = require("./70.js");
var i = require("./28.js");
var o = require("./84.js");
var a = require("./332.js");
var s = require("./333.js");
var l = require("./152.js");
var u = require("./742.js");
var c = require("./334.js");
i(i.S + i.F * !require("./743.js")(function (e) {
  Array.from(e);
}), "Array", {
  from: function (e) {
    var t;
    var n;
    var i;
    var d;
    var f = o(e);
    var p = typeof this == "function" ? this : Array;
    var h = arguments.length;
    var m = h > 1 ? arguments[1] : undefined;
    var y = m !== undefined;
    var g = 0;
    var v = c(f);
    if (y) {
      m = r(m, h > 2 ? arguments[2] : undefined, 2);
    }
    if (v == undefined || p == Array && s(v)) {
      for (n = new p(t = l(f.length)); t > g; g++) {
        u(n, g, y ? m(f[g], g) : f[g]);
      }
    } else {
      d = v.call(f);
      n = new p();
      for (; !(i = d.next()).done; g++) {
        u(n, g, y ? a(d, m, [i.value, g], true) : i.value);
      }
    }
    n.length = g;
    return n;
  }
});