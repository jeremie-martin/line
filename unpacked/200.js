var t = require("./18.js");
var r = require("./287.js");
var i = typeof window != "undefined" ? window : t !== undefined ? t : typeof self != "undefined" ? self : {};
function o(e) {
  return e === undefined;
}
function a(e) {
  return Object.prototype.toString.call(e) === "[object Object]";
}
function s(e) {
  return Object.prototype.toString.call(e) === "[object String]";
}
function l(e) {
  return Object.prototype.toString.call(e) === "[object Array]";
}
function u() {
  try {
    new ErrorEvent("");
    return true;
  } catch (e) {
    return false;
  }
}
function c() {
  if (!("fetch" in i)) {
    return false;
  }
  try {
    new Headers();
    new Request("");
    new Response();
    return true;
  } catch (e) {
    return false;
  }
}
function d(e, t) {
  var n;
  var r;
  if (o(e.length)) {
    for (n in e) {
      if (f(e, n)) {
        t.call(null, n, e[n]);
      }
    }
  } else if (r = e.length) {
    for (n = 0; n < r; n++) {
      t.call(null, n, e[n]);
    }
  }
}
function f(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function p(e) {
  var t;
  var n = [];
  for (var r = 0, i = e.length; r < i; r++) {
    if (s(t = e[r])) {
      n.push(t.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"));
    } else if (t && t.source) {
      n.push(t.source);
    }
  }
  return new RegExp(n.join("|"), "i");
}
function h(e) {
  var t;
  var n;
  var r;
  var i;
  var o;
  var a = [];
  if (!e || !e.tagName) {
    return "";
  }
  a.push(e.tagName.toLowerCase());
  if (e.id) {
    a.push("#" + e.id);
  }
  if ((t = e.className) && s(t)) {
    n = t.split(/\s+/);
    o = 0;
    for (; o < n.length; o++) {
      a.push("." + n[o]);
    }
  }
  var l = ["type", "name", "title", "alt"];
  for (o = 0; o < l.length; o++) {
    r = l[o];
    if (i = e.getAttribute(r)) {
      a.push("[" + r + "=\"" + i + "\"]");
    }
  }
  return a.join("");
}
function m(e, t) {
  return !!(!!e ^ !!t);
}
function y(e, t) {
  if (m(e, t)) {
    return false;
  }
  var n;
  var r;
  var i = e.frames;
  var o = t.frames;
  if (i.length !== o.length) {
    return false;
  }
  for (var a = 0; a < i.length; a++) {
    n = i[a];
    r = o[a];
    if (n.filename !== r.filename || n.lineno !== r.lineno || n.colno !== r.colno || n.function !== r.function) {
      return false;
    }
  }
  return true;
}
var g = 3;
var v = 51200;
var b = 40;
function _(e) {
  return function (e) {
    return ~-encodeURI(e).split(/%..|./).length;
  }(JSON.stringify(e));
}
function w(e) {
  if (typeof e == "string") {
    if (e.length <= 40) {
      return e;
    } else {
      return e.substr(0, 39) + "…";
    }
  }
  if (typeof e == "number" || typeof e == "boolean" || e === undefined) {
    return e;
  }
  var t = Object.prototype.toString.call(e);
  if (t === "[object Object]") {
    return "[Object]";
  } else if (t === "[object Array]") {
    return "[Array]";
  } else if (t === "[object Function]") {
    if (e.name) {
      return "[Function: " + e.name + "]";
    } else {
      return "[Function]";
    }
  } else {
    return e;
  }
}
module.exports = {
  isObject: function (e) {
    return typeof e == "object" && e !== null;
  },
  isError: function (e) {
    switch ({}.toString.call(e)) {
      case "[object Error]":
      case "[object Exception]":
      case "[object DOMException]":
        return true;
      default:
        return e instanceof Error;
    }
  },
  isErrorEvent: function (e) {
    return u() && {}.toString.call(e) === "[object ErrorEvent]";
  },
  isUndefined: o,
  isFunction: function (e) {
    return typeof e == "function";
  },
  isPlainObject: a,
  isString: s,
  isArray: l,
  isEmptyObject: function (e) {
    if (!a(e)) {
      return false;
    }
    for (var t in e) {
      if (e.hasOwnProperty(t)) {
        return false;
      }
    }
    return true;
  },
  supportsErrorEvent: u,
  supportsFetch: c,
  supportsReferrerPolicy: function () {
    if (!c()) {
      return false;
    }
    try {
      new Request("pickleRick", {
        referrerPolicy: "origin"
      });
      return true;
    } catch (e) {
      return false;
    }
  },
  supportsPromiseRejectionEvent: function () {
    return typeof PromiseRejectionEvent == "function";
  },
  wrappedCallback: function (e) {
    return function (t, n) {
      var r = e(t) || t;
      return n && n(r) || r;
    };
  },
  each: d,
  objectMerge: function (e, t) {
    if (t) {
      d(t, function (t, n) {
        e[t] = n;
      });
      return e;
    } else {
      return e;
    }
  },
  truncate: function (e, t) {
    if (!t || e.length <= t) {
      return e;
    } else {
      return e.substr(0, t) + "…";
    }
  },
  objectFrozen: function (e) {
    return !!Object.isFrozen && Object.isFrozen(e);
  },
  hasKey: f,
  joinRegExp: p,
  urlencode: function (e) {
    var t = [];
    d(e, function (e, n) {
      t.push(encodeURIComponent(e) + "=" + encodeURIComponent(n));
    });
    return t.join("&");
  },
  uuid4: function () {
    var e = i.crypto || i.msCrypto;
    if (!o(e) && e.getRandomValues) {
      var t = new Uint16Array(8);
      e.getRandomValues(t);
      t[3] = t[3] & 4095 | 16384;
      t[4] = t[4] & 16383 | 32768;
      function n(e) {
        for (var t = e.toString(16); t.length < 4;) {
          t = "0" + t;
        }
        return t;
      }
      return n(t[0]) + n(t[1]) + n(t[2]) + n(t[3]) + n(t[4]) + n(t[5]) + n(t[6]) + n(t[7]);
    }
    return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, function (e) {
      var t = Math.random() * 16 | 0;
      return (e === "x" ? t : t & 3 | 8).toString(16);
    });
  },
  htmlTreeAsString: function (e) {
    for (var t, n = [], r = 0, i = 0, o = " > ".length; e && r++ < 5 && (t = h(e)) !== "html" && (!(r > 1) || !(i + n.length * o + t.length >= 80));) {
      n.push(t);
      i += t.length;
      e = e.parentNode;
    }
    return n.reverse().join(" > ");
  },
  htmlElementAsString: h,
  isSameException: function (e, t) {
    return !m(e, t) && (e = e.values[0], t = t.values[0], e.type === t.type && e.value === t.value && (n = e.stacktrace, r = t.stacktrace, (!o(n) || !o(r)) && y(e.stacktrace, t.stacktrace)));
    var n;
    var r;
  },
  isSameStacktrace: y,
  parseUrl: function (e) {
    if (typeof e != "string") {
      return {};
    }
    var t = e.match(/^(([^:\/?#]+):)?(\/\/([^\/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/);
    var n = t[6] || "";
    var r = t[8] || "";
    return {
      protocol: t[2],
      host: t[4],
      path: t[5],
      relative: t[5] + n + r
    };
  },
  fill: function (e, t, n, r) {
    if (e != null) {
      var i = e[t];
      e[t] = n(i);
      e[t].__raven__ = true;
      e[t].__orig__ = i;
      if (r) {
        r.push([e, t, i]);
      }
    }
  },
  safeJoin: function (e, t) {
    if (!l(e)) {
      return "";
    }
    var n = [];
    for (var r = 0; r < e.length; r++) {
      try {
        n.push(String(e[r]));
      } catch (e) {
        n.push("[value cannot be serialized]");
      }
    }
    return n.join(t);
  },
  serializeException: function e(t, n, i) {
    if (!a(t)) {
      return t;
    }
    i = typeof (n = typeof n != "number" ? g : n) != "number" ? v : i;
    var o = function e(t, n) {
      if (n === 0) {
        return w(t);
      } else if (a(t)) {
        return Object.keys(t).reduce(function (r, i) {
          r[i] = e(t[i], n - 1);
          return r;
        }, {});
      } else if (Array.isArray(t)) {
        return t.map(function (t) {
          return e(t, n - 1);
        });
      } else {
        return w(t);
      }
    }(t, n);
    if (_(r(o)) > i) {
      return e(t, n - 1);
    } else {
      return o;
    }
  },
  serializeKeysForMessage: function (e, t) {
    if (typeof e == "number" || typeof e == "string") {
      return e.toString();
    }
    if (!Array.isArray(e)) {
      return "";
    }
    if ((e = e.filter(function (e) {
      return typeof e == "string";
    })).length === 0) {
      return "[object has no keys]";
    }
    t = typeof t != "number" ? b : t;
    if (e[0].length >= t) {
      return e[0];
    }
    for (var n = e.length; n > 0; n--) {
      var r = e.slice(0, n).join(", ");
      if (!(r.length > t)) {
        if (n === e.length) {
          return r;
        } else {
          return r + "…";
        }
      }
    }
    return "";
  },
  sanitize: function (e, t) {
    if (!l(t) || l(t) && t.length === 0) {
      return e;
    }
    var n;
    var i = p(t);
    var o = "********";
    try {
      n = JSON.parse(r(e));
    } catch (t) {
      return e;
    }
    return function e(t) {
      if (l(t)) {
        return t.map(function (t) {
          return e(t);
        });
      } else if (a(t)) {
        return Object.keys(t).reduce(function (n, r) {
          if (i.test(r)) {
            n[r] = o;
          } else {
            n[r] = e(t[r]);
          }
          return n;
        }, {});
      } else {
        return t;
      }
    }(n);
  }
};