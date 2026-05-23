var e = require("./18.js");
var r = require("./194.js");
var i = /%[sdj%]/g;
exports.format = function (e) {
  if (!g(e)) {
    var t = [];
    for (var n = 0; n < arguments.length; n++) {
      t.push(s(arguments[n]));
    }
    return t.join(" ");
  }
  n = 1;
  for (var r = arguments, o = r.length, a = String(e).replace(i, function (e) {
      if (e === "%%") {
        return "%";
      }
      if (n >= o) {
        return e;
      }
      switch (e) {
        case "%s":
          return String(r[n++]);
        case "%d":
          return Number(r[n++]);
        case "%j":
          try {
            return JSON.stringify(r[n++]);
          } catch (e) {
            return "[Circular]";
          }
        default:
          return e;
      }
    }), l = r[n]; n < o; l = r[++n]) {
    if (m(l) || !_(l)) {
      a += " " + l;
    } else {
      a += " " + s(l);
    }
  }
  return a;
};
exports.deprecate = function (n, i) {
  if (v(e.process)) {
    return function () {
      return exports.deprecate(n, i).apply(this, arguments);
    };
  }
  if (r.noDeprecation === true) {
    return n;
  }
  var o = false;
  return function () {
    if (!o) {
      if (r.throwDeprecation) {
        throw new Error(i);
      }
      if (r.traceDeprecation) {
        console.trace(i);
      } else {
        console.error(i);
      }
      o = true;
    }
    return n.apply(this, arguments);
  };
};
var o;
var a = {};
function s(e, n) {
  var r = {
    seen: [],
    stylize: u
  };
  if (arguments.length >= 3) {
    r.depth = arguments[2];
  }
  if (arguments.length >= 4) {
    r.colors = arguments[3];
  }
  if (h(n)) {
    r.showHidden = n;
  } else if (n) {
    exports._extend(r, n);
  }
  if (v(r.showHidden)) {
    r.showHidden = false;
  }
  if (v(r.depth)) {
    r.depth = 2;
  }
  if (v(r.colors)) {
    r.colors = false;
  }
  if (v(r.customInspect)) {
    r.customInspect = true;
  }
  if (r.colors) {
    r.stylize = l;
  }
  return c(r, e, r.depth);
}
function l(e, t) {
  var n = s.styles[t];
  if (n) {
    return "[" + s.colors[n][0] + "m" + e + "[" + s.colors[n][1] + "m";
  } else {
    return e;
  }
}
function u(e, t) {
  return e;
}
function c(e, n, r) {
  if (e.customInspect && n && E(n.inspect) && n.inspect !== exports.inspect && (!n.constructor || n.constructor.prototype !== n)) {
    var i = n.inspect(r, e);
    if (!g(i)) {
      i = c(e, i, r);
    }
    return i;
  }
  var o = function (e, t) {
    if (v(t)) {
      return e.stylize("undefined", "undefined");
    }
    if (g(t)) {
      var n = "'" + JSON.stringify(t).replace(/^"|"$/g, "").replace(/'/g, "\\'").replace(/\\"/g, "\"") + "'";
      return e.stylize(n, "string");
    }
    if (y(t)) {
      return e.stylize("" + t, "number");
    }
    if (h(t)) {
      return e.stylize("" + t, "boolean");
    }
    if (m(t)) {
      return e.stylize("null", "null");
    }
  }(e, n);
  if (o) {
    return o;
  }
  var a = Object.keys(n);
  var s = function (e) {
    var t = {};
    e.forEach(function (e, n) {
      t[e] = true;
    });
    return t;
  }(a);
  if (e.showHidden) {
    a = Object.getOwnPropertyNames(n);
  }
  if (x(n) && (a.indexOf("message") >= 0 || a.indexOf("description") >= 0)) {
    return d(n);
  }
  if (a.length === 0) {
    if (E(n)) {
      var l = n.name ? ": " + n.name : "";
      return e.stylize("[Function" + l + "]", "special");
    }
    if (b(n)) {
      return e.stylize(RegExp.prototype.toString.call(n), "regexp");
    }
    if (w(n)) {
      return e.stylize(Date.prototype.toString.call(n), "date");
    }
    if (x(n)) {
      return d(n);
    }
  }
  var u;
  var _ = "";
  var S = false;
  var T = ["{", "}"];
  if (p(n)) {
    S = true;
    T = ["[", "]"];
  }
  if (E(n)) {
    _ = " [Function" + (n.name ? ": " + n.name : "") + "]";
  }
  if (b(n)) {
    _ = " " + RegExp.prototype.toString.call(n);
  }
  if (w(n)) {
    _ = " " + Date.prototype.toUTCString.call(n);
  }
  if (x(n)) {
    _ = " " + d(n);
  }
  if (a.length !== 0 || S && n.length != 0) {
    if (r < 0) {
      if (b(n)) {
        return e.stylize(RegExp.prototype.toString.call(n), "regexp");
      } else {
        return e.stylize("[Object]", "special");
      }
    } else {
      e.seen.push(n);
      u = S ? function (e, t, n, r, i) {
        var o = [];
        for (var a = 0, s = t.length; a < s; ++a) {
          if (O(t, String(a))) {
            o.push(f(e, t, n, r, String(a), true));
          } else {
            o.push("");
          }
        }
        i.forEach(function (i) {
          if (!i.match(/^\d+$/)) {
            o.push(f(e, t, n, r, i, true));
          }
        });
        return o;
      }(e, n, r, s, a) : a.map(function (t) {
        return f(e, n, r, s, t, S);
      });
      e.seen.pop();
      return function (e, t, n) {
        if (e.reduce(function (e, t) {
          0;
          if (t.indexOf("\n") >= 0) {
            0;
          }
          return e + t.replace(/\u001b\[\d\d?m/g, "").length + 1;
        }, 0) > 60) {
          return n[0] + (t === "" ? "" : t + "\n ") + " " + e.join(",\n  ") + " " + n[1];
        }
        return n[0] + t + " " + e.join(", ") + " " + n[1];
      }(u, _, T);
    }
  } else {
    return T[0] + _ + T[1];
  }
}
function d(e) {
  return "[" + Error.prototype.toString.call(e) + "]";
}
function f(e, t, n, r, i, o) {
  var a;
  var s;
  var l;
  if ((l = Object.getOwnPropertyDescriptor(t, i) || {
    value: t[i]
  }).get) {
    s = l.set ? e.stylize("[Getter/Setter]", "special") : e.stylize("[Getter]", "special");
  } else if (l.set) {
    s = e.stylize("[Setter]", "special");
  }
  if (!O(r, i)) {
    a = "[" + i + "]";
  }
  if (!s) {
    if (e.seen.indexOf(l.value) < 0) {
      if ((s = m(n) ? c(e, l.value, null) : c(e, l.value, n - 1)).indexOf("\n") > -1) {
        s = o ? s.split("\n").map(function (e) {
          return "  " + e;
        }).join("\n").substr(2) : "\n" + s.split("\n").map(function (e) {
          return "   " + e;
        }).join("\n");
      }
    } else {
      s = e.stylize("[Circular]", "special");
    }
  }
  if (v(a)) {
    if (o && i.match(/^\d+$/)) {
      return s;
    }
    if ((a = JSON.stringify("" + i)).match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      a = a.substr(1, a.length - 2);
      a = e.stylize(a, "name");
    } else {
      a = a.replace(/'/g, "\\'").replace(/\\"/g, "\"").replace(/(^"|"$)/g, "'");
      a = e.stylize(a, "string");
    }
  }
  return a + ": " + s;
}
function p(e) {
  return Array.isArray(e);
}
function h(e) {
  return typeof e == "boolean";
}
function m(e) {
  return e === null;
}
function y(e) {
  return typeof e == "number";
}
function g(e) {
  return typeof e == "string";
}
function v(e) {
  return e === undefined;
}
function b(e) {
  return _(e) && S(e) === "[object RegExp]";
}
function _(e) {
  return typeof e == "object" && e !== null;
}
function w(e) {
  return _(e) && S(e) === "[object Date]";
}
function x(e) {
  return _(e) && (S(e) === "[object Error]" || e instanceof Error);
}
function E(e) {
  return typeof e == "function";
}
function S(e) {
  return Object.prototype.toString.call(e);
}
function T(e) {
  if (e < 10) {
    return "0" + e.toString(10);
  } else {
    return e.toString(10);
  }
}
exports.debuglog = function (e) {
  if (v(o)) {
    o = r.env.NODE_DEBUG || "";
  }
  e = e.toUpperCase();
  if (!a[e]) {
    if (new RegExp("\\b" + e + "\\b", "i").test(o)) {
      var n = r.pid;
      a[e] = function () {
        var r = exports.format.apply(exports, arguments);
        console.error("%s %d: %s", e, n, r);
      };
    } else {
      a[e] = function () {};
    }
  }
  return a[e];
};
exports.inspect = s;
s.colors = {
  bold: [1, 22],
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27],
  white: [37, 39],
  grey: [90, 39],
  black: [30, 39],
  blue: [34, 39],
  cyan: [36, 39],
  green: [32, 39],
  magenta: [35, 39],
  red: [31, 39],
  yellow: [33, 39]
};
s.styles = {
  special: "cyan",
  number: "yellow",
  boolean: "yellow",
  undefined: "grey",
  null: "bold",
  string: "green",
  date: "magenta",
  regexp: "red"
};
exports.isArray = p;
exports.isBoolean = h;
exports.isNull = m;
exports.isNullOrUndefined = function (e) {
  return e == null;
};
exports.isNumber = y;
exports.isString = g;
exports.isSymbol = function (e) {
  return typeof e == "symbol";
};
exports.isUndefined = v;
exports.isRegExp = b;
exports.isObject = _;
exports.isDate = w;
exports.isError = x;
exports.isFunction = E;
exports.isPrimitive = function (e) {
  return e === null || typeof e == "boolean" || typeof e == "number" || typeof e == "string" || typeof e == "symbol" || e === undefined;
};
exports.isBuffer = require("./604.js");
var k = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function O(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
exports.log = function () {
  var e;
  var n;
  console.log("%s - %s", (e = new Date(), n = [T(e.getHours()), T(e.getMinutes()), T(e.getSeconds())].join(":"), [e.getDate(), k[e.getMonth()], n].join(" ")), exports.format.apply(exports, arguments));
};
exports.inherits = require("./605.js");
exports._extend = function (e, t) {
  if (!t || !_(t)) {
    return e;
  }
  var n = Object.keys(t);
  for (var r = n.length; r--;) {
    e[n[r]] = t[n[r]];
  }
  return e;
};