var r = require("./30.js");
var i = require("./53.js");
var o = require("./51.js");
var a = require("./102.js")("src");
var s = Function.toString;
var l = ("" + s).split("toString");
require("./183.js").inspectSource = function (e) {
  return s.call(e);
};
(module.exports = function (e, t, n, s) {
  var u = typeof n == "function";
  if (u) {
    if (!o(n, "name")) {
      i(n, "name", t);
    }
  }
  if (e[t] !== n) {
    if (u) {
      if (!o(n, a)) {
        i(n, a, e[t] ? "" + e[t] : l.join(String(t)));
      }
    }
    if (e === r) {
      e[t] = n;
    } else if (s) {
      if (e[t]) {
        e[t] = n;
      } else {
        i(e, t, n);
      }
    } else {
      delete e[t];
      i(e, t, n);
    }
  }
})(Function.prototype, "toString", function () {
  return typeof this == "function" && this[a] || s.call(this);
});