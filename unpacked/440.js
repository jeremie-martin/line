require("./138.js")("split", 2, function (e, t, r) {
  "use strict";

  var i = require("./441.js");
  var o = r;
  var a = [].push;
  if ("abbc".split(/(b)*/)[1] == "c" || "test".split(/(?:)/, -1).length != 4 || "ab".split(/(?:ab)*/).length != 2 || ".".split(/(.?)(.?)/).length != 4 || ".".split(/()()/).length > 1 || "".split(/.?/).length) {
    var s = /()??/.exec("")[1] === undefined;
    r = function (e, t) {
      var n = String(this);
      if (e === undefined && t === 0) {
        return [];
      }
      if (!i(e)) {
        return o.call(n, e, t);
      }
      var r;
      var l;
      var u;
      var c;
      var d;
      var f = [];
      var p = (e.ignoreCase ? "i" : "") + (e.multiline ? "m" : "") + (e.unicode ? "u" : "") + (e.sticky ? "y" : "");
      var h = 0;
      var m = t === undefined ? 4294967295 : t >>> 0;
      var y = new RegExp(e.source, p + "g");
      for (s || (r = new RegExp("^" + y.source + "$(?!\\s)", p)); (l = y.exec(n)) && (!((u = l.index + l[0].length) > h) || !(f.push(n.slice(h, l.index)), !s && l.length > 1 && l[0].replace(r, function () {
        for (d = 1; d < arguments.length - 2; d++) {
          if (arguments[d] === undefined) {
            l[d] = undefined;
          }
        }
      }), l.length > 1 && l.index < n.length && a.apply(f, l.slice(1)), c = l[0].length, h = u, f.length >= m));) {
        if (y.lastIndex === l.index) {
          y.lastIndex++;
        }
      }
      if (h === n.length) {
        if (!!c || !y.test("")) {
          f.push("");
        }
      } else {
        f.push(n.slice(h));
      }
      if (f.length > m) {
        return f.slice(0, m);
      } else {
        return f;
      }
    };
  } else if ("0".split(undefined, 0).length) {
    r = function (e, t) {
      if (e === undefined && t === 0) {
        return [];
      } else {
        return o.call(this, e, t);
      }
    };
  }
  return [function (n, i) {
    var o = e(this);
    var a = n == undefined ? undefined : n[t];
    if (a !== undefined) {
      return a.call(n, o, i);
    } else {
      return r.call(String(o), n, i);
    }
  }, r];
});