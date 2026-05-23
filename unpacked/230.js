var r = require("./41.js");
var i = require("./24.js");
var o = require("./227.js");
var a = require("./228.js");
var s = require("./36.js").f;
module.exports = function (e) {
  var t = i.Symbol ||= o ? {} : r.Symbol || {};
  if (e.charAt(0) != "_" && !(e in t)) {
    s(t, e, {
      value: a.f(e)
    });
  }
};