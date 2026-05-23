var r = require("./218.js");
var i = require("./215.js");
module.exports = function (e) {
  return function (t, n) {
    var o;
    var a;
    var s = String(i(t));
    var l = r(n);
    var u = s.length;
    if (l < 0 || l >= u) {
      if (e) {
        return "";
      } else {
        return undefined;
      }
    } else if ((o = s.charCodeAt(l)) < 55296 || o > 56319 || l + 1 === u || (a = s.charCodeAt(l + 1)) < 56320 || a > 57343) {
      if (e) {
        return s.charAt(l);
      } else {
        return o;
      }
    } else if (e) {
      return s.slice(l, l + 2);
    } else {
      return a - 56320 + (o - 55296 << 10) + 65536;
    }
  };
};