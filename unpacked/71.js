var r = require("./49.js");
module.exports = function (e) {
  if (!r(e)) {
    throw TypeError(e + " is not an object!");
  }
  return e;
};