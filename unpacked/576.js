var r = require("./577.js");
var i = require("./578.js");
var o = require("./584.js");
var a = require("./148.js");
module.exports = function (e, t, n) {
  if (!a(n)) {
    return false;
  }
  var s = typeof t;
  return !!(s == "number" ? i(n) && o(t, n.length) : s == "string" && t in n) && r(n[t], e);
};