var r = require("./300.js");
var i = require("./588.js");
var o = "[object Symbol]";
module.exports = function (e) {
  return typeof e == "symbol" || i(e) && r(e) == o;
};