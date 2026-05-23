var r = require("./217.js");
module.exports = Array.isArray || function (e) {
  return r(e) == "Array";
};