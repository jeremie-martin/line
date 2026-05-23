var r = require("./30.js");
var i = require("./183.js");
var o = require("./188.js");
var a = require("./265.js");
var s = require("./54.js").f;
module.exports = function (e) {
  var t = i.Symbol ||= o ? {} : r.Symbol || {};
  if (e.charAt(0) != "_" && !(e in t)) {
    s(t, e, {
      value: a.f(e)
    });
  }
};