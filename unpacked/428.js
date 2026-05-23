var r = require("./79.js");
var i = require("./429.js");
var o = require("./430.js");
module.exports = function (e) {
  return function (t, n, a) {
    var s;
    var l = r(t);
    var u = i(l.length);
    var c = o(a, u);
    if (e && n != n) {
      while (u > c) {
        if ((s = l[c++]) != s) {
          return true;
        }
      }
    } else {
      for (; u > c; c++) {
        if ((e || c in l) && l[c] === n) {
          return e || c || 0;
        }
      }
    }
    return !e && -1;
  };
};