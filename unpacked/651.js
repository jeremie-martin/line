var r = require("./652.js");
var i = require("./325.js");
var o = require("./118.js");
var a = require("./85.js");
module.exports = require("./226.js")(Array, "Array", function (e, t) {
  this._t = a(e);
  this._i = 0;
  this._k = t;
}, function () {
  var e = this._t;
  var t = this._k;
  var n = this._i++;
  if (!e || n >= e.length) {
    this._t = undefined;
    return i(1);
  } else {
    return i(0, t == "keys" ? n : t == "values" ? e[n] : [n, e[n]]);
  }
}, "values");
o.Arguments = o.Array;
r("keys");
r("values");
r("entries");