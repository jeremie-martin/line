var r = require("./78.js");
var i = require("./30.js").document;
var o = r(i) && r(i.createElement);
module.exports = function (e) {
  if (o) {
    return i.createElement(e);
  } else {
    return {};
  }
};