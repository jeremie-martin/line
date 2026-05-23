var r = Array.prototype.slice;
var i = require("./515.js");
var o = require("./516.js");
var a = module.exports = function (e, t, n) {
  n ||= {};
  return e === t || (e instanceof Date && t instanceof Date ? e.getTime() === t.getTime() : !e || !t || typeof e != "object" && typeof t != "object" ? n.strict ? e === t : e == t : function (e, t, n) {
    var u;
    var c;
    if (s(e) || s(t)) {
      return false;
    }
    if (e.prototype !== t.prototype) {
      return false;
    }
    if (o(e)) {
      return !!o(t) && (e = r.call(e), t = r.call(t), a(e, t, n));
    }
    if (l(e)) {
      if (!l(t)) {
        return false;
      }
      if (e.length !== t.length) {
        return false;
      }
      for (u = 0; u < e.length; u++) {
        if (e[u] !== t[u]) {
          return false;
        }
      }
      return true;
    }
    try {
      var d = i(e);
      var f = i(t);
    } catch (e) {
      return false;
    }
    if (d.length != f.length) {
      return false;
    }
    d.sort();
    f.sort();
    u = d.length - 1;
    for (; u >= 0; u--) {
      if (d[u] != f[u]) {
        return false;
      }
    }
    for (u = d.length - 1; u >= 0; u--) {
      c = d[u];
      if (!a(e[c], t[c], n)) {
        return false;
      }
    }
    return typeof e == typeof t;
  }(e, t, n));
};
function s(e) {
  return e === null || e === undefined;
}
function l(e) {
  return !!e && typeof e == "object" && typeof e.length == "number" && typeof e.copy == "function" && typeof e.slice == "function" && (!(e.length > 0) || typeof e[0] == "number");
}