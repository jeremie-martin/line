var r = require("./156.js");
var i = require("./117.js");
var o = require("./157.js");
var a = {};
require("./58.js")(a, require("./31.js")("iterator"), function () {
  return this;
});
module.exports = function (e, t, n) {
  e.prototype = r(a, {
    next: i(1, n)
  });
  o(e, t + " Iterator");
};