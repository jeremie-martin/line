var r = require("./148.js");
var i = require("./587.js");
var o = NaN;
var a = /^\s+|\s+$/g;
var s = /^[-+]0x[0-9a-f]+$/i;
var l = /^0b[01]+$/i;
var u = /^0o[0-7]+$/i;
var c = parseInt;
module.exports = function (e) {
  if (typeof e == "number") {
    return e;
  }
  if (i(e)) {
    return o;
  }
  if (r(e)) {
    var t = typeof e.valueOf == "function" ? e.valueOf() : e;
    e = r(t) ? t + "" : t;
  }
  if (typeof e != "string") {
    if (e === 0) {
      return e;
    } else {
      return +e;
    }
  }
  e = e.replace(a, "");
  var n = l.test(e);
  if (n || u.test(e)) {
    return c(e.slice(2), n ? 2 : 8);
  } else if (s.test(e)) {
    return o;
  } else {
    return +e;
  }
};