var r = require("./116.js");
var i = require("./223.js");
var o = require("./154.js");
var a = require("./84.js");
var s = require("./216.js");
var l = Object.assign;
module.exports = !l || require("./72.js")(function () {
  var e = {};
  var t = {};
  var n = Symbol();
  var r = "abcdefghijklmnopqrst";
  e[n] = 7;
  r.split("").forEach(function (e) {
    t[e] = e;
  });
  return l({}, e)[n] != 7 || Object.keys(l({}, t)).join("") != r;
}) ? function (e, t) {
  var n = a(e);
  for (var l = arguments.length, u = 1, c = i.f, d = o.f; l > u;) {
    var f;
    var p = s(arguments[u++]);
    var h = c ? r(p).concat(c(p)) : r(p);
    for (var m = h.length, y = 0; m > y;) {
      if (d.call(p, f = h[y++])) {
        n[f] = p[f];
      }
    }
  }
  return n;
} : l;