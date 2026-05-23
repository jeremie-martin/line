var r = require("./1007.js");
var i = require("./1011.js");
var o = require("./413.js");
var a = require("./77.js");
var s = require("./1014.js");
var l = require("./1015.js");
var u = {
  M: function (e) {
    return e.getMonth() + 1;
  },
  MM: function (e) {
    return d(e.getMonth() + 1, 2);
  },
  Q: function (e) {
    return Math.ceil((e.getMonth() + 1) / 3);
  },
  D: function (e) {
    return e.getDate();
  },
  DD: function (e) {
    return d(e.getDate(), 2);
  },
  DDD: function (e) {
    return r(e);
  },
  DDDD: function (e) {
    return d(r(e), 3);
  },
  d: function (e) {
    return e.getDay();
  },
  E: function (e) {
    return e.getDay() || 7;
  },
  W: function (e) {
    return i(e);
  },
  WW: function (e) {
    return d(i(e), 2);
  },
  YY: function (e) {
    return d(e.getFullYear(), 4).substr(2);
  },
  YYYY: function (e) {
    return d(e.getFullYear(), 4);
  },
  GG: function (e) {
    return String(o(e)).substr(2);
  },
  GGGG: function (e) {
    return o(e);
  },
  H: function (e) {
    return e.getHours();
  },
  HH: function (e) {
    return d(e.getHours(), 2);
  },
  h: function (e) {
    var t = e.getHours();
    if (t === 0) {
      return 12;
    } else if (t > 12) {
      return t % 12;
    } else {
      return t;
    }
  },
  hh: function (e) {
    return d(u.h(e), 2);
  },
  m: function (e) {
    return e.getMinutes();
  },
  mm: function (e) {
    return d(e.getMinutes(), 2);
  },
  s: function (e) {
    return e.getSeconds();
  },
  ss: function (e) {
    return d(e.getSeconds(), 2);
  },
  S: function (e) {
    return Math.floor(e.getMilliseconds() / 100);
  },
  SS: function (e) {
    return d(Math.floor(e.getMilliseconds() / 10), 2);
  },
  SSS: function (e) {
    return d(e.getMilliseconds(), 3);
  },
  Z: function (e) {
    return c(e.getTimezoneOffset(), ":");
  },
  ZZ: function (e) {
    return c(e.getTimezoneOffset());
  },
  X: function (e) {
    return Math.floor(e.getTime() / 1000);
  },
  x: function (e) {
    return e.getTime();
  }
};
function c(e, t) {
  t = t || "";
  var n = e > 0 ? "-" : "+";
  var r = Math.abs(e);
  var i = r % 60;
  return n + d(Math.floor(r / 60), 2) + t + d(i, 2);
}
function d(e, t) {
  for (var n = Math.abs(e).toString(); n.length < t;) {
    n = "0" + n;
  }
  return n;
}
module.exports = function (e, t, n) {
  var r = t ? String(t) : "YYYY-MM-DDTHH:mm:ss.SSSZ";
  var i = (n || {}).locale;
  var o = l.format.formatters;
  var c = l.format.formattingTokensRegExp;
  if (i && i.format && i.format.formatters) {
    o = i.format.formatters;
    if (i.format.formattingTokensRegExp) {
      c = i.format.formattingTokensRegExp;
    }
  }
  var d = a(e);
  if (s(d)) {
    return function (e, t, n) {
      var r;
      var i;
      var o;
      var a = e.match(n);
      var s = a.length;
      for (r = 0; r < s; r++) {
        i = t[a[r]] || u[a[r]];
        a[r] = i || ((o = a[r]).match(/\[[\s\S]/) ? o.replace(/^\[|]$/g, "") : o.replace(/\\/g, ""));
      }
      return function (e) {
        var t = "";
        for (var n = 0; n < s; n++) {
          if (a[n] instanceof Function) {
            t += a[n](e, u);
          } else {
            t += a[n];
          }
        }
        return t;
      };
    }(r, o, c)(d);
  } else {
    return "Invalid Date";
  }
};