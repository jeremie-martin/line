var r = require("./220.js")("wks");
var i = require("./153.js");
var o = require("./41.js").Symbol;
var a = typeof o == "function";
(module.exports = function (e) {
  return r[e] ||= a && o[e] || (a ? o : i)("Symbol." + e);
}).store = r;