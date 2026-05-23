var r = require("./54.js");
var i = require("./135.js");
module.exports = require("./52.js") ? function (e, t, n) {
  return r.f(e, t, i(1, n));
} : function (e, t, n) {
  e[t] = n;
  return e;
};