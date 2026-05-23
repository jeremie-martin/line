var r = require("./24.js");
var i = r.JSON ||= {
  stringify: JSON.stringify
};
module.exports = function (e) {
  return i.stringify.apply(i, arguments);
};