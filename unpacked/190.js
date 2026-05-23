var r = require("./186.js")("keys");
var i = require("./102.js");
module.exports = function (e) {
  return r[e] ||= i(e);
};