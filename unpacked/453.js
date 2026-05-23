var r = require("./269.js");
var i = require("./135.js");
var o = require("./187.js");
var a = {};
require("./53.js")(a, require("./47.js")("iterator"), function () {
  return this;
});
module.exports = function (e, t, n) {
  e.prototype = r(a, {
    next: i(1, n)
  });
  o(e, t + " Iterator");
};