var r = require("./301.js");
var i = require("./581.js");
var o = require("./582.js");
var a = "[object Null]";
var s = "[object Undefined]";
var l = r ? r.toStringTag : undefined;
module.exports = function (e) {
  if (e == null) {
    if (e === undefined) {
      return s;
    } else {
      return a;
    }
  } else if (l && l in Object(e)) {
    return i(e);
  } else {
    return o(e);
  }
};