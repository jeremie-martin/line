var r = require("./77.js");
module.exports = function (e) {
  var t = r(e);
  var n = new Date(0);
  n.setFullYear(t.getFullYear(), 0, 1);
  n.setHours(0, 0, 0, 0);
  return n;
};