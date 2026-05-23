var r = require("./77.js");
var i = require("./257.js");
module.exports = function (e) {
  var t = r(e);
  var n = t.getFullYear();
  var o = new Date(0);
  o.setFullYear(n + 1, 0, 4);
  o.setHours(0, 0, 0, 0);
  var a = i(o);
  var s = new Date(0);
  s.setFullYear(n, 0, 4);
  s.setHours(0, 0, 0, 0);
  var l = i(s);
  if (t.getTime() >= a.getTime()) {
    return n + 1;
  } else if (t.getTime() >= l.getTime()) {
    return n;
  } else {
    return n - 1;
  }
};