var r = require("./36.js");
var i = require("./71.js");
var o = require("./116.js");
module.exports = require("./42.js") ? Object.defineProperties : function (e, t) {
  i(e);
  var n;
  var a = o(t);
  for (var s = a.length, l = 0; s > l;) {
    r.f(e, n = a[l++], t[n]);
  }
  return e;
};