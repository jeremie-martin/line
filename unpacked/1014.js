var r = require("./412.js");
module.exports = function (e) {
  if (r(e)) {
    return !isNaN(e);
  }
  throw new TypeError(toString.call(e) + " is not an instance of Date");
};