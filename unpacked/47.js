var r = require("./186.js")("wks");
var i = require("./102.js");
var o = require("./30.js").Symbol;
var a = typeof o == "function";
(module.exports = function (e) {
  return r[e] ||= a && o[e] || (a ? o : i)("Symbol." + e);
}).store = r;