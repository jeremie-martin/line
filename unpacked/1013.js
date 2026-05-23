var r = require("./413.js");
var i = require("./257.js");
module.exports = function (e) {
  var t = r(e);
  var n = new Date(0);
  n.setFullYear(t, 0, 4);
  n.setHours(0, 0, 0, 0);
  return i(n);
};