var r = require("./58.js");
module.exports = function (e, t, n) {
  for (var i in t) {
    if (n && e[i]) {
      e[i] = t[i];
    } else {
      r(e, i, t[i]);
    }
  }
  return e;
};