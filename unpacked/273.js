var r;
var i;
var o = {};
r = function () {
  return window && document && document.all && !window.atob;
};
function a() {
  if (i === undefined) {
    i = r.apply(this, arguments);
  }
  return i;
}
var s = function (e) {
  var t = {};
  return function (e) {
    if (typeof e == "function") {
      return e();
    }
    if (t[e] === undefined) {
      var n = function (e) {
        return document.querySelector(e);
      }.call(this, e);
      if (window.HTMLIFrameElement && n instanceof window.HTMLIFrameElement) {
        try {
          n = n.contentDocument.head;
        } catch (e) {
          n = null;
        }
      }
      t[e] = n;
    }
    return t[e];
  };
}();
var l = null;
var u = 0;
var c = [];
var d = require("./474.js");
function f(e, t) {
  for (var n = 0; n < e.length; n++) {
    var r = e[n];
    var i = o[r.id];
    if (i) {
      i.refs++;
      for (var a = 0; a < i.parts.length; a++) {
        i.parts[a](r.parts[a]);
      }
      for (; a < r.parts.length; a++) {
        i.parts.push(v(r.parts[a], t));
      }
    } else {
      var s = [];
      for (a = 0; a < r.parts.length; a++) {
        s.push(v(r.parts[a], t));
      }
      o[r.id] = {
        id: r.id,
        refs: 1,
        parts: s
      };
    }
  }
}
function p(e, t) {
  var n = [];
  var r = {};
  for (var i = 0; i < e.length; i++) {
    var o = e[i];
    var a = t.base ? o[0] + t.base : o[0];
    var s = {
      css: o[1],
      media: o[2],
      sourceMap: o[3]
    };
    if (r[a]) {
      r[a].parts.push(s);
    } else {
      n.push(r[a] = {
        id: a,
        parts: [s]
      });
    }
  }
  return n;
}
function h(e, t) {
  var n = s(e.insertInto);
  if (!n) {
    throw new Error("Couldn't find a style target. This probably means that the value for the 'insertInto' parameter is invalid.");
  }
  var r = c[c.length - 1];
  if (e.insertAt === "top") {
    if (r) {
      if (r.nextSibling) {
        n.insertBefore(t, r.nextSibling);
      } else {
        n.appendChild(t);
      }
    } else {
      n.insertBefore(t, n.firstChild);
    }
    c.push(t);
  } else if (e.insertAt === "bottom") {
    n.appendChild(t);
  } else {
    if (typeof e.insertAt != "object" || !e.insertAt.before) {
      throw new Error("[Style Loader]\n\n Invalid value for parameter 'insertAt' ('options.insertAt') found.\n Must be 'top', 'bottom', or Object.\n (https://github.com/webpack-contrib/style-loader#insertat)\n");
    }
    var i = s(e.insertInto + " " + e.insertAt.before);
    n.insertBefore(t, i);
  }
}
function m(e) {
  if (e.parentNode === null) {
    return false;
  }
  e.parentNode.removeChild(e);
  var t = c.indexOf(e);
  if (t >= 0) {
    c.splice(t, 1);
  }
}
function y(e) {
  var t = document.createElement("style");
  e.attrs.type = "text/css";
  g(t, e.attrs);
  h(e, t);
  return t;
}
function g(e, t) {
  Object.keys(t).forEach(function (n) {
    e.setAttribute(n, t[n]);
  });
}
function v(e, t) {
  var n;
  var r;
  var i;
  var o;
  if (t.transform && e.css) {
    if (!(o = t.transform(e.css))) {
      return function () {};
    }
    e.css = o;
  }
  if (t.singleton) {
    var a = u++;
    n = l ||= y(t);
    r = w.bind(null, n, a, false);
    i = w.bind(null, n, a, true);
  } else if (e.sourceMap && typeof URL == "function" && typeof URL.createObjectURL == "function" && typeof URL.revokeObjectURL == "function" && typeof Blob == "function" && typeof btoa == "function") {
    n = function (e) {
      var t = document.createElement("link");
      e.attrs.type = "text/css";
      e.attrs.rel = "stylesheet";
      g(t, e.attrs);
      h(e, t);
      return t;
    }(t);
    r = function (e, t, n) {
      var r = n.css;
      var i = n.sourceMap;
      var o = t.convertToAbsoluteUrls === undefined && i;
      if (t.convertToAbsoluteUrls || o) {
        r = d(r);
      }
      if (i) {
        r += "\n/*# sourceMappingURL=data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(i)))) + " */";
      }
      var a = new Blob([r], {
        type: "text/css"
      });
      var s = e.href;
      e.href = URL.createObjectURL(a);
      if (s) {
        URL.revokeObjectURL(s);
      }
    }.bind(null, n, t);
    i = function () {
      m(n);
      if (n.href) {
        URL.revokeObjectURL(n.href);
      }
    };
  } else {
    n = y(t);
    r = function (e, t) {
      var n = t.css;
      var r = t.media;
      if (r) {
        e.setAttribute("media", r);
      }
      if (e.styleSheet) {
        e.styleSheet.cssText = n;
      } else {
        while (e.firstChild) {
          e.removeChild(e.firstChild);
        }
        e.appendChild(document.createTextNode(n));
      }
    }.bind(null, n);
    i = function () {
      m(n);
    };
  }
  r(e);
  return function (t) {
    if (t) {
      if (t.css === e.css && t.media === e.media && t.sourceMap === e.sourceMap) {
        return;
      }
      r(e = t);
    } else {
      i();
    }
  };
}
module.exports = function (e, t) {
  if (typeof DEBUG != "undefined" && DEBUG && typeof document != "object") {
    throw new Error("The style-loader cannot be used in a non-browser environment");
  }
  (t = t || {}).attrs = typeof t.attrs == "object" ? t.attrs : {};
  if (!t.singleton && typeof t.singleton != "boolean") {
    t.singleton = a();
  }
  t.insertInto ||= "head";
  t.insertAt ||= "bottom";
  var n = p(e, t);
  f(n, t);
  return function (e) {
    var r = [];
    for (var i = 0; i < n.length; i++) {
      var a = n[i];
      (s = o[a.id]).refs--;
      r.push(s);
    }
    if (e) {
      f(p(e, t), t);
    }
    for (i = 0; i < r.length; i++) {
      var s;
      if ((s = r[i]).refs === 0) {
        for (var l = 0; l < s.parts.length; l++) {
          s.parts[l]();
        }
        delete o[s.id];
      }
    }
  };
};
var b;
b = [];
function _(e, t) {
  b[e] = t;
  return b.filter(Boolean).join("\n");
}
function w(e, t, n, r) {
  var i = n ? "" : r.css;
  if (e.styleSheet) {
    e.styleSheet.cssText = _(t, i);
  } else {
    var o = document.createTextNode(i);
    var a = e.childNodes;
    if (a[t]) {
      e.removeChild(a[t]);
    }
    if (a.length) {
      e.insertBefore(o, a[t]);
    } else {
      e.appendChild(o);
    }
  }
}