var r = require("./100.js");
module.exports = function () {
  var e = r(this);
  var t = "";
  if (e.global) {
    t += "g";
  }
  if (e.ignoreCase) {
    t += "i";
  }
  if (e.multiline) {
    t += "m";
  }
  if (e.unicode) {
    t += "u";
  }
  if (e.sticky) {
    t += "y";
  }
  return t;
};