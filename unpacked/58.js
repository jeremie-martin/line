var r = require("./36.js");
var i = require("./117.js");
module.exports = require("./42.js") ? function (e, t, n) {
  return r.f(e, t, i(1, n));
} : function (e, t, n) {
  e[t] = n;
  return e;
};