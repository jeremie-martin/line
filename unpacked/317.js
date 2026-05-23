var r = require("./28.js");
var i = require("./24.js");
var o = require("./72.js");
module.exports = function (e, t) {
  var n = (i.Object || {})[e] || Object[e];
  var a = {};
  a[e] = t(n);
  r(r.S + r.F * o(function () {
    n(1);
  }), "Object", a);
};