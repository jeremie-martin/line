var r = require("./488.js");
module.exports = function (e) {
  return r(e) && e.nodeType == 3;
};