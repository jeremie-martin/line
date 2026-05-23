var r = require("./77.js");
module.exports = function (e, t) {
  var n = t && Number(t.weekStartsOn) || 0;
  var i = r(e);
  var o = i.getDay();
  var a = (o < n ? 7 : 0) + o - n;
  i.setDate(i.getDate() - a);
  i.setHours(0, 0, 0, 0);
  return i;
};