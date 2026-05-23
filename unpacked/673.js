var r = require("./70.js");
var i = require("./216.js");
var o = require("./84.js");
var a = require("./152.js");
var s = require("./674.js");
module.exports = function (e, t) {
  var n = e == 1;
  var l = e == 2;
  var u = e == 3;
  var c = e == 4;
  var d = e == 6;
  var f = e == 5 || d;
  var p = t || s;
  return function (t, s, h) {
    var m;
    var y;
    var g = o(t);
    var v = i(g);
    var b = r(s, h, 3);
    for (var _ = a(v.length), w = 0, x = n ? p(t, _) : l ? p(t, 0) : undefined; _ > w; w++) {
      if ((f || w in v) && (y = b(m = v[w], w, g), e)) {
        if (n) {
          x[w] = y;
        } else if (y) {
          switch (e) {
            case 3:
              return true;
            case 5:
              return m;
            case 6:
              return w;
            case 2:
              x.push(m);
          }
        } else if (c) {
          return false;
        }
      }
    }
    if (d) {
      return -1;
    } else if (u || c) {
      return c;
    } else {
      return x;
    }
  };
};