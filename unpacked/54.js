var r = require("./100.js");
var i = require("./263.js");
var o = require("./185.js");
var a = Object.defineProperty;
exports.f = require("./52.js") ? Object.defineProperty : function (e, t, n) {
  r(e);
  t = o(t, true);
  r(n);
  if (i) {
    try {
      return a(e, t, n);
    } catch (e) {}
  }
  if ("get" in n || "set" in n) {
    throw TypeError("Accessors not supported!");
  }
  if ("value" in n) {
    e[t] = n.value;
  }
  return e;
};