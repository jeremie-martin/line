var r = require("./1010.js");
var i = 60000;
var o = 86400000;
module.exports = function (e, t) {
  var n = r(e);
  var a = r(t);
  var s = n.getTime() - n.getTimezoneOffset() * i;
  var l = a.getTime() - a.getTimezoneOffset() * i;
  return Math.round((s - l) / o);
};