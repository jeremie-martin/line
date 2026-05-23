var r = require("./49.js");
module.exports = function (e, t) {
  if (!r(e) || e._t !== t) {
    throw TypeError("Incompatible receiver, " + t + " required!");
  }
  return e;
};