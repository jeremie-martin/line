var r = require("./102.js")("meta");
var i = require("./78.js");
var o = require("./51.js");
var a = require("./54.js").f;
var s = 0;
var l = Object.isExtensible || function () {
  return true;
};
var u = !require("./99.js")(function () {
  return l(Object.preventExtensions({}));
});
function c(e) {
  a(e, r, {
    value: {
      i: "O" + ++s,
      w: {}
    }
  });
}
var d = module.exports = {
  KEY: r,
  NEED: false,
  fastKey: function (e, t) {
    if (!i(e)) {
      if (typeof e == "symbol") {
        return e;
      } else {
        return (typeof e == "string" ? "S" : "P") + e;
      }
    }
    if (!o(e, r)) {
      if (!l(e)) {
        return "F";
      }
      if (!t) {
        return "E";
      }
      c(e);
    }
    return e[r].i;
  },
  getWeak: function (e, t) {
    if (!o(e, r)) {
      if (!l(e)) {
        return true;
      }
      if (!t) {
        return false;
      }
      c(e);
    }
    return e[r].w;
  },
  onFreeze: function (e) {
    if (u && d.NEED && l(e) && !o(e, r)) {
      c(e);
    }
    return e;
  }
};