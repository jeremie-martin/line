var r = require("./335.js");
var i = require("./678.js");
module.exports = function (e) {
  return function () {
    if (r(this) != e) {
      throw TypeError(e + "#toJSON isn't generic");
    }
    return i(this);
  };
};