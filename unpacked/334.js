var r = require("./335.js");
var i = require("./31.js")("iterator");
var o = require("./118.js");
module.exports = require("./24.js").getIteratorMethod = function (e) {
  if (e != undefined) {
    return e[i] || e["@@iterator"] || o[r(e)];
  }
};