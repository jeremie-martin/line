var r = require("./47.js")("unscopables");
var i = Array.prototype;
if (i[r] == undefined) {
  require("./53.js")(i, r, {});
}
module.exports = function (e) {
  i[r][e] = true;
};