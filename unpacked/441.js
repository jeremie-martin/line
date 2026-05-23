var r = require("./78.js");
var i = require("./137.js");
var o = require("./47.js")("match");
module.exports = function (e) {
  var t;
  return r(e) && ((t = e[o]) !== undefined ? !!t : i(e) == "RegExp");
};