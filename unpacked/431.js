var r = require("./137.js");
module.exports = Array.isArray || function (e) {
  return r(e) == "Array";
};