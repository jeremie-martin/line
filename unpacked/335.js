var r = require("./217.js");
var i = require("./31.js")("toStringTag");
var o = r(function () {
  return arguments;
}()) == "Arguments";
module.exports = function (e) {
  var t;
  var n;
  var a;
  if (e === undefined) {
    return "Undefined";
  } else if (e === null) {
    return "Null";
  } else if (typeof (n = function (e, t) {
    try {
      return e[t];
    } catch (e) {}
  }(t = Object(e), i)) == "string") {
    return n;
  } else if (o) {
    return r(t);
  } else if ((a = r(t)) == "Object" && typeof t.callee == "function") {
    return "Arguments";
  } else {
    return a;
  }
};