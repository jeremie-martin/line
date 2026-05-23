var r = require("./78.js");
module.exports = function (e) {
  if (!r(e)) {
    throw TypeError(e + " is not an object!");
  }
  return e;
};