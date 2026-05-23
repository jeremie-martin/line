var r = require("./36.js");
var i = require("./117.js");
module.exports = function (e, t, n) {
  if (t in e) {
    r.f(e, t, i(0, n));
  } else {
    e[t] = n;
  }
};