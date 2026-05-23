var r = require("./970.js");
function i(e) {
  return r(e) === true && Object.prototype.toString.call(e) === "[object Object]";
}
module.exports = function (e) {
  var t;
  var n;
  return i(e) !== false && typeof (t = e.constructor) == "function" && i(n = t.prototype) !== false && n.hasOwnProperty("isPrototypeOf") !== false;
};