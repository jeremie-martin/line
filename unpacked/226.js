var r = require("./227.js");
var i = require("./28.js");
var o = require("./323.js");
var a = require("./58.js");
var s = require("./69.js");
var l = require("./118.js");
var u = require("./648.js");
var c = require("./157.js");
var d = require("./322.js");
var f = require("./31.js")("iterator");
var p = ![].keys || !("next" in [].keys());
function h() {
  return this;
}
module.exports = function (e, t, n, m, y, g, v) {
  u(n, t, m);
  var b;
  var _;
  var w;
  function x(e) {
    if (!p && e in k) {
      return k[e];
    }
    switch (e) {
      case "keys":
      case "values":
        return function () {
          return new n(this, e);
        };
    }
    return function () {
      return new n(this, e);
    };
  }
  var E = t + " Iterator";
  var S = y == "values";
  var T = false;
  var k = e.prototype;
  var O = k[f] || k["@@iterator"] || y && k[y];
  var P = !p && O || x(y);
  var C = y ? S ? x("entries") : P : undefined;
  var I = t == "Array" && k.entries || O;
  if (I && (w = d(I.call(new e()))) !== Object.prototype && w.next) {
    c(w, E, true);
    if (!r && !s(w, f)) {
      a(w, f, h);
    }
  }
  if (S && O && O.name !== "values") {
    T = true;
    P = function () {
      return O.call(this);
    };
  }
  if ((!r || !!v) && (!!p || !!T || !k[f])) {
    a(k, f, P);
  }
  l[t] = P;
  l[E] = h;
  if (y) {
    b = {
      values: S ? P : x("values"),
      keys: g ? P : x("keys"),
      entries: C
    };
    if (v) {
      for (_ in b) {
        if (!(_ in k)) {
          o(k, _, b[_]);
        }
      }
    } else {
      i(i.P + i.F * (p || T), t, b);
    }
  }
  return b;
};