var r = require("./36.js").f;
var i = require("./69.js");
var o = require("./31.js")("toStringTag");
module.exports = function (e, t, n) {
  if (e && !i(e = n ? e : e.prototype, o)) {
    r(e, o, {
      configurable: true,
      value: t
    });
  }
};