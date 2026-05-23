var r = require("./300.js");
var i = require("./148.js");
var o = "[object AsyncFunction]";
var a = "[object Function]";
var s = "[object GeneratorFunction]";
var l = "[object Proxy]";
module.exports = function (e) {
  if (!i(e)) {
    return false;
  }
  var t = r(e);
  return t == a || t == s || t == o || t == l;
};