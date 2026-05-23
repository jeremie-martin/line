var r = require("./41.js");
var i = require("./24.js");
var o = require("./36.js");
var a = require("./42.js");
var s = require("./31.js")("species");
module.exports = function (e) {
  var t = typeof i[e] == "function" ? i[e] : r[e];
  if (a && t && !t[s]) {
    o.f(t, s, {
      configurable: true,
      get: function () {
        return this;
      }
    });
  }
};