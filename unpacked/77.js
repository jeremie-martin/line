var r = require("./412.js");
var i = 3600000;
var o = 60000;
var a = 2;
var s = /[T ]/;
var l = /:/;
var u = /^(\d{2})$/;
var c = [/^([+-]\d{2})$/, /^([+-]\d{3})$/, /^([+-]\d{4})$/];
var d = /^(\d{4})/;
var f = [/^([+-]\d{4})/, /^([+-]\d{5})/, /^([+-]\d{6})/];
var p = /^-(\d{2})$/;
var h = /^-?(\d{3})$/;
var m = /^-?(\d{2})-?(\d{2})$/;
var y = /^-?W(\d{2})$/;
var g = /^-?W(\d{2})-?(\d{1})$/;
var v = /^(\d{2}([.,]\d*)?)$/;
var b = /^(\d{2}):?(\d{2}([.,]\d*)?)$/;
var _ = /^(\d{2}):?(\d{2}):?(\d{2}([.,]\d*)?)$/;
var w = /([Z+-].*)$/;
var x = /^(Z)$/;
var E = /^([+-])(\d{2})$/;
var S = /^([+-])(\d{2}):?(\d{2})$/;
function T(e, t, n) {
  t = t || 0;
  n = n || 0;
  var r = new Date(0);
  r.setUTCFullYear(e, 0, 4);
  var i = t * 7 + n + 1 - (r.getUTCDay() || 7);
  r.setUTCDate(r.getUTCDate() + i);
  return r;
}
module.exports = function (e, t) {
  if (r(e)) {
    return new Date(e.getTime());
  }
  if (typeof e != "string") {
    return new Date(e);
  }
  var n = (t || {}).additionalDigits;
  n = n == null ? a : Number(n);
  var k = function (e) {
    var t;
    var n = {};
    var r = e.split(s);
    if (l.test(r[0])) {
      n.date = null;
      t = r[0];
    } else {
      n.date = r[0];
      t = r[1];
    }
    if (t) {
      var i = w.exec(t);
      if (i) {
        n.time = t.replace(i[1], "");
        n.timezone = i[1];
      } else {
        n.time = t;
      }
    }
    return n;
  }(e);
  var O = function (e, t) {
    var n;
    var r = c[t];
    var i = f[t];
    if (n = d.exec(e) || i.exec(e)) {
      var o = n[1];
      return {
        year: parseInt(o, 10),
        restDateString: e.slice(o.length)
      };
    }
    if (n = u.exec(e) || r.exec(e)) {
      var a = n[1];
      return {
        year: parseInt(a, 10) * 100,
        restDateString: e.slice(a.length)
      };
    }
    return {
      year: null
    };
  }(k.date, n);
  var P = O.year;
  var C = function (e, t) {
    if (t === null) {
      return null;
    }
    var n;
    var r;
    var i;
    var o;
    if (e.length === 0) {
      (r = new Date(0)).setUTCFullYear(t);
      return r;
    }
    if (n = p.exec(e)) {
      r = new Date(0);
      i = parseInt(n[1], 10) - 1;
      r.setUTCFullYear(t, i);
      return r;
    }
    if (n = h.exec(e)) {
      r = new Date(0);
      var a = parseInt(n[1], 10);
      r.setUTCFullYear(t, 0, a);
      return r;
    }
    if (n = m.exec(e)) {
      r = new Date(0);
      i = parseInt(n[1], 10) - 1;
      var s = parseInt(n[2], 10);
      r.setUTCFullYear(t, i, s);
      return r;
    }
    if (n = y.exec(e)) {
      o = parseInt(n[1], 10) - 1;
      return T(t, o);
    }
    if (n = g.exec(e)) {
      o = parseInt(n[1], 10) - 1;
      var l = parseInt(n[2], 10) - 1;
      return T(t, o, l);
    }
    return null;
  }(O.restDateString, P);
  if (C) {
    var I;
    var M = C.getTime();
    var L = 0;
    if (k.time) {
      L = function (e) {
        var t;
        var n;
        var r;
        if (t = v.exec(e)) {
          return (n = parseFloat(t[1].replace(",", "."))) % 24 * i;
        }
        if (t = b.exec(e)) {
          n = parseInt(t[1], 10);
          r = parseFloat(t[2].replace(",", "."));
          return n % 24 * i + r * o;
        }
        if (t = _.exec(e)) {
          n = parseInt(t[1], 10);
          r = parseInt(t[2], 10);
          var a = parseFloat(t[3].replace(",", "."));
          return n % 24 * i + r * o + a * 1000;
        }
        return null;
      }(k.time);
    }
    if (k.timezone) {
      R = k.timezone;
      I = (A = x.exec(R)) ? 0 : (A = E.exec(R)) ? (D = parseInt(A[2], 10) * 60, A[1] === "+" ? -D : D) : (A = S.exec(R)) ? (D = parseInt(A[2], 10) * 60 + parseInt(A[3], 10), A[1] === "+" ? -D : D) : 0;
    } else {
      I = new Date(M + L).getTimezoneOffset();
      I = new Date(M + L + I * o).getTimezoneOffset();
    }
    return new Date(M + L + I * o);
  }
  var R;
  var A;
  var D;
  return new Date(e);
};