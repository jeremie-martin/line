var r = require("./69.js");
var i = require("./85.js");
var o = require("./636.js")(false);
var a = require("./219.js")("IE_PROTO");
module.exports = function (e, t) {
  var n;
  var s = i(e);
  var l = 0;
  var u = [];
  for (n in s) {
    if (n != a && r(s, n)) {
      u.push(n);
    }
  }
  while (t.length > l) {
    if (r(s, n = t[l++])) {
      if (!~o(u, n)) {
        u.push(n);
      }
    }
  }
  return u;
};