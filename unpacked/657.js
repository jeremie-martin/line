var r = require("./85.js");
var i = require("./327.js").f;
var o = {}.toString;
var a = typeof window == "object" && window && Object.getOwnPropertyNames ? Object.getOwnPropertyNames(window) : [];
module.exports.f = function (e) {
  if (a && o.call(e) == "[object Window]") {
    return function (e) {
      try {
        return i(e);
      } catch (e) {
        return a.slice();
      }
    }(e);
  } else {
    return i(r(e));
  }
};