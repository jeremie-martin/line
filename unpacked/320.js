var r = require("./49.js");
var i = require("./41.js").document;
var o = r(i) && r(i.createElement);
module.exports = function (e) {
  if (o) {
    return i.createElement(e);
  } else {
    return {};
  }
};