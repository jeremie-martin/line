var t = require("./18.js");
var r = require("./200.js");
var i = {
  collectWindowErrors: true,
  debug: false
};
var o = typeof window != "undefined" ? window : t !== undefined ? t : typeof self != "undefined" ? self : {};
var a = [].slice;
var s = "?";
var l = /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/;
function u() {
  if (typeof document == "undefined" || document.location == null) {
    return "";
  } else {
    return document.location.href;
  }
}
i.report = function () {
  var e;
  var t;
  var n = [];
  var c = null;
  var d = null;
  var f = null;
  function p(e, t) {
    var r = null;
    if (!t || i.collectWindowErrors) {
      for (var o in n) {
        if (n.hasOwnProperty(o)) {
          try {
            n[o].apply(null, [e].concat(a.call(arguments, 2)));
          } catch (e) {
            r = e;
          }
        }
      }
      if (r) {
        throw r;
      }
    }
  }
  function h(t, n, o, a, c) {
    var d = r.isErrorEvent(c) ? c.error : c;
    var h = r.isErrorEvent(t) ? t.message : t;
    if (f) {
      i.computeStackTrace.augmentStackTraceWithInitialElement(f, n, o, h);
      m();
    } else if (d && r.isError(d)) {
      p(i.computeStackTrace(d), true);
    } else {
      var y;
      var g = {
        url: n,
        line: o,
        column: a
      };
      var v = undefined;
      if ({}.toString.call(h) === "[object String]") {
        if (y = h.match(l)) {
          v = y[1];
          h = y[2];
        }
      }
      g.func = s;
      p({
        name: v,
        message: h,
        url: u(),
        stack: [g]
      }, true);
    }
    return !!e && e.apply(this, arguments);
  }
  function m() {
    var e = f;
    var t = c;
    c = null;
    f = null;
    d = null;
    p.apply(null, [e, false].concat(t));
  }
  function y(e, t) {
    var n = a.call(arguments, 1);
    if (f) {
      if (d === e) {
        return;
      }
      m();
    }
    var r = i.computeStackTrace(e);
    f = r;
    d = e;
    c = n;
    setTimeout(function () {
      if (d === e) {
        m();
      }
    }, r.incomplete ? 2000 : 0);
    if (t !== false) {
      throw e;
    }
  }
  y.subscribe = function (r) {
    if (!t) {
      e = o.onerror;
      o.onerror = h;
      t = true;
    }
    n.push(r);
  };
  y.unsubscribe = function (e) {
    for (var t = n.length - 1; t >= 0; --t) {
      if (n[t] === e) {
        n.splice(t, 1);
      }
    }
  };
  y.uninstall = function () {
    if (t) {
      o.onerror = e;
      t = false;
      e = undefined;
    }
    n = [];
  };
  return y;
}();
i.computeStackTrace = function () {
  function e(e) {
    if (e.stack !== undefined && e.stack) {
      var t;
      var n;
      var r;
      var i = /^\s*at (?:(.*?) ?\()?((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|[a-z]:|\/).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
      var o = /^\s*at (?:((?:\[object object\])?.+) )?\(?((?:file|ms-appx(?:-web)|https?|webpack|blob):.*?):(\d+)(?::(\d+))?\)?\s*$/i;
      var a = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)((?:file|https?|blob|chrome|webpack|resource|moz-extension).*?:\/.*?|\[native code\]|[^@]*bundle)(?::(\d+))?(?::(\d+))?\s*$/i;
      var l = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
      var c = /\((\S*)(?::(\d+))(?::(\d+))\)/;
      var d = e.stack.split("\n");
      var f = [];
      for (var p = (/^(.*) is undefined$/.exec(e.message), 0), h = d.length; p < h; ++p) {
        if (n = i.exec(d[p])) {
          var m = n[2] && n[2].indexOf("native") === 0;
          if (n[2] && n[2].indexOf("eval") === 0 && (t = c.exec(n[2]))) {
            n[2] = t[1];
            n[3] = t[2];
            n[4] = t[3];
          }
          r = {
            url: m ? null : n[2],
            func: n[1] || s,
            args: m ? [n[2]] : [],
            line: n[3] ? +n[3] : null,
            column: n[4] ? +n[4] : null
          };
        } else if (n = o.exec(d[p])) {
          r = {
            url: n[2],
            func: n[1] || s,
            args: [],
            line: +n[3],
            column: n[4] ? +n[4] : null
          };
        } else {
          if (!(n = a.exec(d[p]))) {
            continue;
          }
          if (n[3] && n[3].indexOf(" > eval") > -1 && (t = l.exec(n[3]))) {
            n[3] = t[1];
            n[4] = t[2];
            n[5] = null;
          } else if (p === 0 && !n[5] && e.columnNumber !== undefined) {
            f[0].column = e.columnNumber + 1;
          }
          r = {
            url: n[3],
            func: n[1] || s,
            args: n[2] ? n[2].split(",") : [],
            line: n[4] ? +n[4] : null,
            column: n[5] ? +n[5] : null
          };
        }
        if (!r.func && r.line) {
          r.func = s;
        }
        f.push(r);
      }
      if (f.length) {
        return {
          name: e.name,
          message: e.message,
          url: u(),
          stack: f
        };
      } else {
        return null;
      }
    }
  }
  function t(e, t, n, r) {
    var i = {
      url: t,
      line: n
    };
    if (i.url && i.line) {
      e.incomplete = false;
      i.func ||= s;
      if (e.stack.length > 0 && e.stack[0].url === i.url) {
        if (e.stack[0].line === i.line) {
          return false;
        }
        if (!e.stack[0].line && e.stack[0].func === i.func) {
          e.stack[0].line = i.line;
          return false;
        }
      }
      e.stack.unshift(i);
      e.partial = true;
      return true;
    }
    e.incomplete = true;
    return false;
  }
  function n(e, o) {
    var a;
    var l;
    var c = /function\s+([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)?\s*\(/i;
    var d = [];
    var f = {};
    for (var p = false, h = n.caller; h && !p; h = h.caller) {
      if (h !== r && h !== i.report) {
        l = {
          url: null,
          func: s,
          line: null,
          column: null
        };
        if (h.name) {
          l.func = h.name;
        } else if (a = c.exec(h.toString())) {
          l.func = a[1];
        }
        if (l.func === undefined) {
          try {
            l.func = a.input.substring(0, a.input.indexOf("{"));
          } catch (e) {}
        }
        if (f["" + h]) {
          p = true;
        } else {
          f["" + h] = true;
        }
        d.push(l);
      }
    }
    if (o) {
      d.splice(0, o);
    }
    var m = {
      name: e.name,
      message: e.message,
      url: u(),
      stack: d
    };
    t(m, e.sourceURL || e.fileName, e.line || e.lineNumber, e.message || e.description);
    return m;
  }
  function r(t, r) {
    var o = null;
    r = r == null ? 0 : +r;
    try {
      if (o = e(t)) {
        return o;
      }
    } catch (e) {
      if (i.debug) {
        throw e;
      }
    }
    try {
      if (o = n(t, r + 1)) {
        return o;
      }
    } catch (e) {
      if (i.debug) {
        throw e;
      }
    }
    return {
      name: t.name,
      message: t.message,
      url: u()
    };
  }
  r.augmentStackTraceWithInitialElement = t;
  r.computeStackTraceFromStackProp = e;
  return r;
}();
module.exports = i;