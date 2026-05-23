var r = require("./54.js");
var i = require("./100.js");
var o = require("./136.js");
module.exports = require("./52.js") ? Object.defineProperties : function (e, t) {
  i(e);
  var n;
  var a = o(t);
  for (var s = a.length, l = 0; s > l;) {
    r.f(e, n = a[l++], t[n]);
  }
  return e;
};