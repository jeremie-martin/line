var r = require("./69.js");
var i = require("./84.js");
var o = require("./219.js")("IE_PROTO");
var a = Object.prototype;
module.exports = Object.getPrototypeOf || function (e) {
  e = i(e);
  if (r(e, o)) {
    return e[o];
  } else if (typeof e.constructor == "function" && e instanceof e.constructor) {
    return e.constructor.prototype;
  } else if (e instanceof Object) {
    return a;
  } else {
    return null;
  }
};