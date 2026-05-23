var r = require("./952.js");
function i(e, t, n, i, a) {
  var s = +new Date();
  var l = t[e];
  var u = false;
  var c = o;
  var d = 350;
  if (typeof i == "function") {
    a = i;
  } else {
    c = (i = i || {}).ease || c;
    d = i.duration || d;
    a = a || function () {};
  }
  if (l === n) {
    return a(new Error("Element already at target scroll position"), t[e]);
  }
  r(function i(o) {
    if (u) {
      return a(new Error("Scroll cancelled"), t[e]);
    }
    var f = +new Date();
    var p = Math.min(1, (f - s) / d);
    var h = c(p);
    t[e] = h * (n - l) + l;
    r(p < 1 ? i : function () {
      a(null, t[e]);
    });
  });
  return function () {
    u = true;
  };
}
function o(e) {
  return (1 - Math.cos(Math.PI * e)) * 0.5;
}
module.exports = {
  top: function (e, t, n, r) {
    return i("scrollTop", e, t, n, r);
  },
  left: function (e, t, n, r) {
    return i("scrollLeft", e, t, n, r);
  }
};