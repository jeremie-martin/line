var r = require("./54.js").f;
var i = require("./51.js");
var o = require("./47.js")("toStringTag");
module.exports = function (e, t, n) {
  if (e && !i(e = n ? e : e.prototype, o)) {
    r(e, o, {
      configurable: true,
      value: t
    });
  }
};