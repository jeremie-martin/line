var r = require("./51.js");
var i = require("./79.js");
var o = require("./428.js")(false);
var a = require("./190.js")("IE_PROTO");
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