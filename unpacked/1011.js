var r = require("./77.js");
var i = require("./257.js");
var o = require("./1013.js");
var a = 604800000;
module.exports = function (e) {
  var t = r(e);
  var n = i(t).getTime() - o(t).getTime();
  return Math.round(n / a) + 1;
};