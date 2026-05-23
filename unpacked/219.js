var r = require("./220.js")("keys");
var i = require("./153.js");
module.exports = function (e) {
  return r[e] ||= i(e);
};