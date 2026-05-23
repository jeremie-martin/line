import * as e from "./18.js";
var n = typeof window != "undefined" && typeof document != "undefined";
for (var r = ["Edge", "Trident", "Firefox"], i = 0, o = 0; o < r.length; o += 1) {
  if (n && navigator.userAgent.indexOf(r[o]) >= 0) {
    i = 1;
    break;
  }
}
var a = n && window.Promise ? function (e) {
  var t = false;
  return function () {
    if (!t) {
      t = true;
      window.Promise.resolve().then(function () {
        t = false;
        e();
      });
    }
  };
} : function (e) {
  var t = false;
  return function () {
    if (!t) {
      t = true;
      setTimeout(function () {
        t = false;
        e();
      }, i);
    }
  };
};
function s(e) {
  return e && {}.toString.call(e) === "[object Function]";
}
function l(e, t) {
  if (e.nodeType !== 1) {
    return [];
  }
  var n = getComputedStyle(e, null);
  if (t) {
    return n[t];
  } else {
    return n;
  }
}
function u(e) {
  if (e.nodeName === "HTML") {
    return e;
  } else {
    return e.parentNode || e.host;
  }
}
function c(e) {
  if (!e) {
    return document.body;
  }
  switch (e.nodeName) {
    case "HTML":
    case "BODY":
      return e.ownerDocument.body;
    case "#document":
      return e.body;
  }
  var t = l(e);
  var n = t.overflow;
  var r = t.overflowX;
  var i = t.overflowY;
  if (/(auto|scroll)/.test(n + i + r)) {
    return e;
  } else {
    return c(u(e));
  }
}
function d(e) {
  var t = e && e.offsetParent;
  var n = t && t.nodeName;
  if (n && n !== "BODY" && n !== "HTML") {
    if (["TD", "TABLE"].indexOf(t.nodeName) !== -1 && l(t, "position") === "static") {
      return d(t);
    } else {
      return t;
    }
  } else if (e) {
    return e.ownerDocument.documentElement;
  } else {
    return document.documentElement;
  }
}
function f(e) {
  if (e.parentNode !== null) {
    return f(e.parentNode);
  } else {
    return e;
  }
}
function p(e, t) {
  if (!e || !e.nodeType || !t || !t.nodeType) {
    return document.documentElement;
  }
  var n = e.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING;
  var r = n ? e : t;
  var i = n ? t : e;
  var o = document.createRange();
  o.setStart(r, 0);
  o.setEnd(i, 0);
  var a;
  var s;
  var l = o.commonAncestorContainer;
  if (e !== l && t !== l || r.contains(i)) {
    if ((s = (a = l).nodeName) === "BODY" || s !== "HTML" && d(a.firstElementChild) !== a) {
      return d(l);
    } else {
      return l;
    }
  }
  var u = f(e);
  if (u.host) {
    return p(u.host, t);
  } else {
    return p(e, f(t).host);
  }
}
function h(e) {
  var t = (arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "top") === "top" ? "scrollTop" : "scrollLeft";
  var n = e.nodeName;
  if (n === "BODY" || n === "HTML") {
    var r = e.ownerDocument.documentElement;
    return (e.ownerDocument.scrollingElement || r)[t];
  }
  return e[t];
}
function m(e, t) {
  var n = t === "x" ? "Left" : "Top";
  var r = n === "Left" ? "Right" : "Bottom";
  return parseFloat(e["border" + n + "Width"], 10) + parseFloat(e["border" + r + "Width"], 10);
}
var y = undefined;
function g() {
  if (y === undefined) {
    y = navigator.appVersion.indexOf("MSIE 10") !== -1;
  }
  return y;
}
function v(e, t, n, r) {
  return Math.max(t["offset" + e], t["scroll" + e], n["client" + e], n["offset" + e], n["scroll" + e], g() ? n["offset" + e] + r["margin" + (e === "Height" ? "Top" : "Left")] + r["margin" + (e === "Height" ? "Bottom" : "Right")] : 0);
}
function b() {
  var e = document.body;
  var t = document.documentElement;
  var n = g() && getComputedStyle(t);
  return {
    height: v("Height", e, t, n),
    width: v("Width", e, t, n)
  };
}
function _(e, t) {
  if (!(e instanceof t)) {
    throw new TypeError("Cannot call a class as a function");
  }
}
var w = function () {
  function e(e, t) {
    for (var n = 0; n < t.length; n++) {
      var r = t[n];
      r.enumerable = r.enumerable || false;
      r.configurable = true;
      if ("value" in r) {
        r.writable = true;
      }
      Object.defineProperty(e, r.key, r);
    }
  }
  return function (t, n, r) {
    if (n) {
      e(t.prototype, n);
    }
    if (r) {
      e(t, r);
    }
    return t;
  };
}();
function x(e, t, n) {
  if (t in e) {
    Object.defineProperty(e, t, {
      value: n,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    e[t] = n;
  }
  return e;
}
var E = Object.assign || function (e) {
  for (var t = 1; t < arguments.length; t++) {
    var n = arguments[t];
    for (var r in n) {
      if (Object.prototype.hasOwnProperty.call(n, r)) {
        e[r] = n[r];
      }
    }
  }
  return e;
};
function S(e) {
  return E({}, e, {
    right: e.left + e.width,
    bottom: e.top + e.height
  });
}
function T(e) {
  var t = {};
  if (g()) {
    try {
      t = e.getBoundingClientRect();
      var n = h(e, "top");
      var r = h(e, "left");
      t.top += n;
      t.left += r;
      t.bottom += n;
      t.right += r;
    } catch (e) {}
  } else {
    t = e.getBoundingClientRect();
  }
  var i = {
    left: t.left,
    top: t.top,
    width: t.right - t.left,
    height: t.bottom - t.top
  };
  var o = e.nodeName === "HTML" ? b() : {};
  var a = o.width || e.clientWidth || i.right - i.left;
  var s = o.height || e.clientHeight || i.bottom - i.top;
  var u = e.offsetWidth - a;
  var c = e.offsetHeight - s;
  if (u || c) {
    var d = l(e);
    u -= m(d, "x");
    c -= m(d, "y");
    i.width -= u;
    i.height -= c;
  }
  return S(i);
}
function k(e, t) {
  var n = g();
  var r = t.nodeName === "HTML";
  var i = T(e);
  var o = T(t);
  var a = c(e);
  var s = l(t);
  var u = parseFloat(s.borderTopWidth, 10);
  var d = parseFloat(s.borderLeftWidth, 10);
  var f = S({
    top: i.top - o.top - u,
    left: i.left - o.left - d,
    width: i.width,
    height: i.height
  });
  f.marginTop = 0;
  f.marginLeft = 0;
  if (!n && r) {
    var p = parseFloat(s.marginTop, 10);
    var m = parseFloat(s.marginLeft, 10);
    f.top -= u - p;
    f.bottom -= u - p;
    f.left -= d - m;
    f.right -= d - m;
    f.marginTop = p;
    f.marginLeft = m;
  }
  if (n ? t.contains(a) : t === a && a.nodeName !== "BODY") {
    f = function (e, t, n = false) {
      var r = h(t, "top");
      var i = h(t, "left");
      var o = n ? -1 : 1;
      e.top += r * o;
      e.bottom += r * o;
      e.left += i * o;
      e.right += i * o;
      return e;
    }(f, t);
  }
  return f;
}
function O(e, t, n, r) {
  var i = {
    top: 0,
    left: 0
  };
  var o = p(e, t);
  if (r === "viewport") {
    i = function (e) {
      var t = e.ownerDocument.documentElement;
      var n = k(e, t);
      var r = Math.max(t.clientWidth, window.innerWidth || 0);
      var i = Math.max(t.clientHeight, window.innerHeight || 0);
      var o = h(t);
      var a = h(t, "left");
      return S({
        top: o - n.top + n.marginTop,
        left: a - n.left + n.marginLeft,
        width: r,
        height: i
      });
    }(o);
  } else {
    var a = undefined;
    if (r === "scrollParent") {
      if ((a = c(u(t))).nodeName === "BODY") {
        a = e.ownerDocument.documentElement;
      }
    } else {
      a = r === "window" ? e.ownerDocument.documentElement : r;
    }
    var s = k(a, o);
    if (a.nodeName !== "HTML" || function e(t) {
      var n = t.nodeName;
      return n !== "BODY" && n !== "HTML" && (l(t, "position") === "fixed" || e(u(t)));
    }(o)) {
      i = s;
    } else {
      var d = b();
      var f = d.height;
      var m = d.width;
      i.top += s.top - s.marginTop;
      i.bottom = f + s.top;
      i.left += s.left - s.marginLeft;
      i.right = m + s.left;
    }
  }
  i.left += n;
  i.top += n;
  i.right -= n;
  i.bottom -= n;
  return i;
}
function P(e, t, n, r, i, o = 0) {
  if (e.indexOf("auto") === -1) {
    return e;
  }
  var a = O(n, r, o, i);
  var s = {
    top: {
      width: a.width,
      height: t.top - a.top
    },
    right: {
      width: a.right - t.right,
      height: a.height
    },
    bottom: {
      width: a.width,
      height: a.bottom - t.bottom
    },
    left: {
      width: t.left - a.left,
      height: a.height
    }
  };
  var l = Object.keys(s).map(function (e) {
    return E({
      key: e
    }, s[e], {
      area: (t = s[e], t.width * t.height)
    });
    var t;
  }).sort(function (e, t) {
    return t.area - e.area;
  });
  var u = l.filter(function (e) {
    var t = e.width;
    var r = e.height;
    return t >= n.clientWidth && r >= n.clientHeight;
  });
  var c = u.length > 0 ? u[0].key : l[0].key;
  var d = e.split("-")[1];
  return c + (d ? "-" + d : "");
}
function C(e, t, n) {
  return k(n, p(t, n));
}
function I(e) {
  var t = getComputedStyle(e);
  var n = parseFloat(t.marginTop) + parseFloat(t.marginBottom);
  var r = parseFloat(t.marginLeft) + parseFloat(t.marginRight);
  return {
    width: e.offsetWidth + r,
    height: e.offsetHeight + n
  };
}
function M(e) {
  var t = {
    left: "right",
    right: "left",
    bottom: "top",
    top: "bottom"
  };
  return e.replace(/left|right|bottom|top/g, function (e) {
    return t[e];
  });
}
function L(e, t, n) {
  n = n.split("-")[0];
  var r = I(e);
  var i = {
    width: r.width,
    height: r.height
  };
  var o = ["right", "left"].indexOf(n) !== -1;
  var a = o ? "top" : "left";
  var s = o ? "left" : "top";
  var l = o ? "height" : "width";
  var u = o ? "width" : "height";
  i[a] = t[a] + t[l] / 2 - r[l] / 2;
  i[s] = n === s ? t[s] - r[u] : t[M(s)];
  return i;
}
function R(e, t) {
  if (Array.prototype.find) {
    return e.find(t);
  } else {
    return e.filter(t)[0];
  }
}
function A(e, t, n) {
  (n === undefined ? e : e.slice(0, function (e, t, n) {
    if (Array.prototype.findIndex) {
      return e.findIndex(function (e) {
        return e[t] === n;
      });
    }
    var r = R(e, function (e) {
      return e[t] === n;
    });
    return e.indexOf(r);
  }(e, "name", n))).forEach(function (e) {
    if (e.function) {
      console.warn("`modifier.function` is deprecated, use `modifier.fn`!");
    }
    var n = e.function || e.fn;
    if (e.enabled && s(n)) {
      t.offsets.popper = S(t.offsets.popper);
      t.offsets.reference = S(t.offsets.reference);
      t = n(t, e);
    }
  });
  return t;
}
function D(e, t) {
  return e.some(function (e) {
    var n = e.name;
    return e.enabled && n === t;
  });
}
function N(e) {
  for (var t = [false, "ms", "Webkit", "Moz", "O"], n = e.charAt(0).toUpperCase() + e.slice(1), r = 0; r < t.length - 1; r++) {
    var i = t[r];
    var o = i ? "" + i + n : e;
    if (document.body.style[o] !== undefined) {
      return o;
    }
  }
  return null;
}
function j(e) {
  var t = e.ownerDocument;
  if (t) {
    return t.defaultView;
  } else {
    return window;
  }
}
function F(e, t, n, r) {
  n.updateBound = r;
  j(e).addEventListener("resize", n.updateBound, {
    passive: true
  });
  var i = c(e);
  (function e(t, n, r, i) {
    var o = t.nodeName === "BODY";
    var a = o ? t.ownerDocument.defaultView : t;
    a.addEventListener(n, r, {
      passive: true
    });
    if (!o) {
      e(c(a.parentNode), n, r, i);
    }
    i.push(a);
  })(i, "scroll", n.updateBound, n.scrollParents);
  n.scrollElement = i;
  n.eventsEnabled = true;
  return n;
}
function B() {
  var e;
  var t;
  if (this.state.eventsEnabled) {
    cancelAnimationFrame(this.scheduleUpdate);
    this.state = (e = this.reference, t = this.state, j(e).removeEventListener("resize", t.updateBound), t.scrollParents.forEach(function (e) {
      e.removeEventListener("scroll", t.updateBound);
    }), t.updateBound = null, t.scrollParents = [], t.scrollElement = null, t.eventsEnabled = false, t);
  }
}
function U(e) {
  return e !== "" && !isNaN(parseFloat(e)) && isFinite(e);
}
function z(e, t) {
  Object.keys(t).forEach(function (n) {
    var r = "";
    if (["width", "height", "top", "right", "bottom", "left"].indexOf(n) !== -1 && U(t[n])) {
      r = "px";
    }
    e.style[n] = t[n] + r;
  });
}
function H(e, t, n) {
  var r = R(e, function (e) {
    return e.name === t;
  });
  var i = !!r && e.some(function (e) {
    return e.name === n && e.enabled && e.order < r.order;
  });
  if (!i) {
    var o = "`" + t + "`";
    var a = "`" + n + "`";
    console.warn(a + " modifier is required by " + o + " modifier in order to work, be sure to include it before " + o + "!");
  }
  return i;
}
var V = ["auto-start", "auto", "auto-end", "top-start", "top", "top-end", "right-start", "right", "right-end", "bottom-end", "bottom", "bottom-start", "left-end", "left", "left-start"];
var W = V.slice(3);
function q(e, t = false) {
  var n = W.indexOf(e);
  var r = W.slice(n + 1).concat(W.slice(0, n));
  if (t) {
    return r.reverse();
  } else {
    return r;
  }
}
function K(e, t, n, r) {
  var i = [0, 0];
  var o = ["right", "left"].indexOf(r) !== -1;
  var a = e.split(/(\+|\-)/).map(function (e) {
    return e.trim();
  });
  var s = a.indexOf(R(a, function (e) {
    return e.search(/,|\s/) !== -1;
  }));
  if (a[s] && a[s].indexOf(",") === -1) {
    console.warn("Offsets separated by white space(s) are deprecated, use a comma (,) instead.");
  }
  var l = /\s*,\s*|\s+/;
  var u = s !== -1 ? [a.slice(0, s).concat([a[s].split(l)[0]]), [a[s].split(l)[1]].concat(a.slice(s + 1))] : [a];
  (u = u.map(function (e, r) {
    var i = (r === 1 ? !o : o) ? "height" : "width";
    var a = false;
    return e.reduce(function (e, t) {
      if (e[e.length - 1] === "" && ["+", "-"].indexOf(t) !== -1) {
        e[e.length - 1] = t;
        a = true;
        return e;
      } else if (a) {
        e[e.length - 1] += t;
        a = false;
        return e;
      } else {
        return e.concat(t);
      }
    }, []).map(function (e) {
      return function (e, t, n, r) {
        var i = e.match(/((?:\-|\+)?\d*\.?\d*)(.*)/);
        var o = +i[1];
        var a = i[2];
        if (!o) {
          return e;
        }
        if (a.indexOf("%") === 0) {
          var s = undefined;
          switch (a) {
            case "%p":
              s = n;
              break;
            case "%":
            case "%r":
            default:
              s = r;
          }
          return S(s)[t] / 100 * o;
        }
        if (a === "vh" || a === "vw") {
          return (a === "vh" ? Math.max(document.documentElement.clientHeight, window.innerHeight || 0) : Math.max(document.documentElement.clientWidth, window.innerWidth || 0)) / 100 * o;
        }
        return o;
      }(e, i, t, n);
    });
  })).forEach(function (e, t) {
    e.forEach(function (n, r) {
      if (U(n)) {
        i[t] += n * (e[r - 1] === "-" ? -1 : 1);
      }
    });
  });
  return i;
}
var Y = {
  placement: "bottom",
  eventsEnabled: true,
  removeOnDestroy: false,
  onCreate: function () {},
  onUpdate: function () {},
  modifiers: {
    shift: {
      order: 100,
      enabled: true,
      fn: function (e) {
        var t = e.placement;
        var n = t.split("-")[0];
        var r = t.split("-")[1];
        if (r) {
          var i = e.offsets;
          var o = i.reference;
          var a = i.popper;
          var s = ["bottom", "top"].indexOf(n) !== -1;
          var l = s ? "left" : "top";
          var u = s ? "width" : "height";
          var c = {
            start: x({}, l, o[l]),
            end: x({}, l, o[l] + o[u] - a[u])
          };
          e.offsets.popper = E({}, a, c[r]);
        }
        return e;
      }
    },
    offset: {
      order: 200,
      enabled: true,
      fn: function (e, t) {
        var n = t.offset;
        var r = e.placement;
        var i = e.offsets;
        var o = i.popper;
        var a = i.reference;
        var s = r.split("-")[0];
        var l = undefined;
        l = U(+n) ? [+n, 0] : K(n, o, a, s);
        if (s === "left") {
          o.top += l[0];
          o.left -= l[1];
        } else if (s === "right") {
          o.top += l[0];
          o.left += l[1];
        } else if (s === "top") {
          o.left += l[0];
          o.top -= l[1];
        } else if (s === "bottom") {
          o.left += l[0];
          o.top += l[1];
        }
        e.popper = o;
        return e;
      },
      offset: 0
    },
    preventOverflow: {
      order: 300,
      enabled: true,
      fn: function (e, t) {
        var n = t.boundariesElement || d(e.instance.popper);
        if (e.instance.reference === n) {
          n = d(n);
        }
        var r = O(e.instance.popper, e.instance.reference, t.padding, n);
        t.boundaries = r;
        var i = t.priority;
        var o = e.offsets.popper;
        var a = {
          primary: function (e) {
            var n = o[e];
            if (o[e] < r[e] && !t.escapeWithReference) {
              n = Math.max(o[e], r[e]);
            }
            return x({}, e, n);
          },
          secondary: function (e) {
            var n = e === "right" ? "left" : "top";
            var i = o[n];
            if (o[e] > r[e] && !t.escapeWithReference) {
              i = Math.min(o[n], r[e] - (e === "right" ? o.width : o.height));
            }
            return x({}, n, i);
          }
        };
        i.forEach(function (e) {
          var t = ["left", "top"].indexOf(e) !== -1 ? "primary" : "secondary";
          o = E({}, o, a[t](e));
        });
        e.offsets.popper = o;
        return e;
      },
      priority: ["left", "right", "top", "bottom"],
      padding: 5,
      boundariesElement: "scrollParent"
    },
    keepTogether: {
      order: 400,
      enabled: true,
      fn: function (e) {
        var t = e.offsets;
        var n = t.popper;
        var r = t.reference;
        var i = e.placement.split("-")[0];
        var o = Math.floor;
        var a = ["top", "bottom"].indexOf(i) !== -1;
        var s = a ? "right" : "bottom";
        var l = a ? "left" : "top";
        var u = a ? "width" : "height";
        if (n[s] < o(r[l])) {
          e.offsets.popper[l] = o(r[l]) - n[u];
        }
        if (n[l] > o(r[s])) {
          e.offsets.popper[l] = o(r[s]);
        }
        return e;
      }
    },
    arrow: {
      order: 500,
      enabled: true,
      fn: function (e, t) {
        var n;
        if (!H(e.instance.modifiers, "arrow", "keepTogether")) {
          return e;
        }
        var r = t.element;
        if (typeof r == "string") {
          if (!(r = e.instance.popper.querySelector(r))) {
            return e;
          }
        } else if (!e.instance.popper.contains(r)) {
          console.warn("WARNING: `arrow.element` must be child of its popper element!");
          return e;
        }
        var i = e.placement.split("-")[0];
        var o = e.offsets;
        var a = o.popper;
        var s = o.reference;
        var u = ["left", "right"].indexOf(i) !== -1;
        var c = u ? "height" : "width";
        var d = u ? "Top" : "Left";
        var f = d.toLowerCase();
        var p = u ? "left" : "top";
        var h = u ? "bottom" : "right";
        var m = I(r)[c];
        if (s[h] - m < a[f]) {
          e.offsets.popper[f] -= a[f] - (s[h] - m);
        }
        if (s[f] + m > a[h]) {
          e.offsets.popper[f] += s[f] + m - a[h];
        }
        e.offsets.popper = S(e.offsets.popper);
        var y = s[f] + s[c] / 2 - m / 2;
        var g = l(e.instance.popper);
        var v = parseFloat(g["margin" + d], 10);
        var b = parseFloat(g["border" + d + "Width"], 10);
        var _ = y - e.offsets.popper[f] - v - b;
        _ = Math.max(Math.min(a[c] - m, _), 0);
        e.arrowElement = r;
        e.offsets.arrow = (x(n = {}, f, Math.round(_)), x(n, p, ""), n);
        return e;
      },
      element: "[x-arrow]"
    },
    flip: {
      order: 600,
      enabled: true,
      fn: function (e, t) {
        if (D(e.instance.modifiers, "inner")) {
          return e;
        }
        if (e.flipped && e.placement === e.originalPlacement) {
          return e;
        }
        var n = O(e.instance.popper, e.instance.reference, t.padding, t.boundariesElement);
        var r = e.placement.split("-")[0];
        var i = M(r);
        var o = e.placement.split("-")[1] || "";
        var a = [];
        switch (t.behavior) {
          case "flip":
            a = [r, i];
            break;
          case "clockwise":
            a = q(r);
            break;
          case "counterclockwise":
            a = q(r, true);
            break;
          default:
            a = t.behavior;
        }
        a.forEach(function (s, l) {
          if (r !== s || a.length === l + 1) {
            return e;
          }
          r = e.placement.split("-")[0];
          i = M(r);
          var u = e.offsets.popper;
          var c = e.offsets.reference;
          var d = Math.floor;
          var f = r === "left" && d(u.right) > d(c.left) || r === "right" && d(u.left) < d(c.right) || r === "top" && d(u.bottom) > d(c.top) || r === "bottom" && d(u.top) < d(c.bottom);
          var p = d(u.left) < d(n.left);
          var h = d(u.right) > d(n.right);
          var m = d(u.top) < d(n.top);
          var y = d(u.bottom) > d(n.bottom);
          var g = r === "left" && p || r === "right" && h || r === "top" && m || r === "bottom" && y;
          var v = ["top", "bottom"].indexOf(r) !== -1;
          var b = !!t.flipVariations && (v && o === "start" && p || v && o === "end" && h || !v && o === "start" && m || !v && o === "end" && y);
          if (f || g || b) {
            e.flipped = true;
            if (f || g) {
              r = a[l + 1];
            }
            if (b) {
              o = function (e) {
                if (e === "end") {
                  return "start";
                } else if (e === "start") {
                  return "end";
                } else {
                  return e;
                }
              }(o);
            }
            e.placement = r + (o ? "-" + o : "");
            e.offsets.popper = E({}, e.offsets.popper, L(e.instance.popper, e.offsets.reference, e.placement));
            e = A(e.instance.modifiers, e, "flip");
          }
        });
        return e;
      },
      behavior: "flip",
      padding: 5,
      boundariesElement: "viewport"
    },
    inner: {
      order: 700,
      enabled: false,
      fn: function (e) {
        var t = e.placement;
        var n = t.split("-")[0];
        var r = e.offsets;
        var i = r.popper;
        var o = r.reference;
        var a = ["left", "right"].indexOf(n) !== -1;
        var s = ["top", "left"].indexOf(n) === -1;
        i[a ? "left" : "top"] = o[n] - (s ? i[a ? "width" : "height"] : 0);
        e.placement = M(t);
        e.offsets.popper = S(i);
        return e;
      }
    },
    hide: {
      order: 800,
      enabled: true,
      fn: function (e) {
        if (!H(e.instance.modifiers, "hide", "preventOverflow")) {
          return e;
        }
        var t = e.offsets.reference;
        var n = R(e.instance.modifiers, function (e) {
          return e.name === "preventOverflow";
        }).boundaries;
        if (t.bottom < n.top || t.left > n.right || t.top > n.bottom || t.right < n.left) {
          if (e.hide === true) {
            return e;
          }
          e.hide = true;
          e.attributes["x-out-of-boundaries"] = "";
        } else {
          if (e.hide === false) {
            return e;
          }
          e.hide = false;
          e.attributes["x-out-of-boundaries"] = false;
        }
        return e;
      }
    },
    computeStyle: {
      order: 850,
      enabled: true,
      fn: function (e, t) {
        var n = t.x;
        var r = t.y;
        var i = e.offsets.popper;
        var o = R(e.instance.modifiers, function (e) {
          return e.name === "applyStyle";
        }).gpuAcceleration;
        if (o !== undefined) {
          console.warn("WARNING: `gpuAcceleration` option moved to `computeStyle` modifier and will not be supported in future versions of Popper.js!");
        }
        var a = o !== undefined ? o : t.gpuAcceleration;
        var s = T(d(e.instance.popper));
        var l = {
          position: i.position
        };
        var u = {
          left: Math.floor(i.left),
          top: Math.floor(i.top),
          bottom: Math.floor(i.bottom),
          right: Math.floor(i.right)
        };
        var c = n === "bottom" ? "top" : "bottom";
        var f = r === "right" ? "left" : "right";
        var p = N("transform");
        var h = undefined;
        var m = undefined;
        m = c === "bottom" ? -s.height + u.bottom : u.top;
        h = f === "right" ? -s.width + u.right : u.left;
        if (a && p) {
          l[p] = "translate3d(" + h + "px, " + m + "px, 0)";
          l[c] = 0;
          l[f] = 0;
          l.willChange = "transform";
        } else {
          var y = c === "bottom" ? -1 : 1;
          var g = f === "right" ? -1 : 1;
          l[c] = m * y;
          l[f] = h * g;
          l.willChange = c + ", " + f;
        }
        var v = {
          "x-placement": e.placement
        };
        e.attributes = E({}, v, e.attributes);
        e.styles = E({}, l, e.styles);
        e.arrowStyles = E({}, e.offsets.arrow, e.arrowStyles);
        return e;
      },
      gpuAcceleration: true,
      x: "bottom",
      y: "right"
    },
    applyStyle: {
      order: 900,
      enabled: true,
      fn: function (e) {
        var t;
        var n;
        z(e.instance.popper, e.styles);
        t = e.instance.popper;
        n = e.attributes;
        Object.keys(n).forEach(function (e) {
          if (n[e] !== false) {
            t.setAttribute(e, n[e]);
          } else {
            t.removeAttribute(e);
          }
        });
        if (e.arrowElement && Object.keys(e.arrowStyles).length) {
          z(e.arrowElement, e.arrowStyles);
        }
        return e;
      },
      onLoad: function (e, t, n, r, i) {
        var o = C(0, t, e);
        var a = P(n.placement, o, t, e, n.modifiers.flip.boundariesElement, n.modifiers.flip.padding);
        t.setAttribute("x-placement", a);
        z(t, {
          position: "absolute"
        });
        return n;
      },
      gpuAcceleration: undefined
    }
  }
};
var $ = function () {
  function e(t, n) {
    var r = this;
    var i = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    _(this, e);
    this.scheduleUpdate = function () {
      return requestAnimationFrame(r.update);
    };
    this.update = a(this.update.bind(this));
    this.options = E({}, e.Defaults, i);
    this.state = {
      isDestroyed: false,
      isCreated: false,
      scrollParents: []
    };
    this.reference = t && t.jquery ? t[0] : t;
    this.popper = n && n.jquery ? n[0] : n;
    this.options.modifiers = {};
    Object.keys(E({}, e.Defaults.modifiers, i.modifiers)).forEach(function (t) {
      r.options.modifiers[t] = E({}, e.Defaults.modifiers[t] || {}, i.modifiers ? i.modifiers[t] : {});
    });
    this.modifiers = Object.keys(this.options.modifiers).map(function (e) {
      return E({
        name: e
      }, r.options.modifiers[e]);
    }).sort(function (e, t) {
      return e.order - t.order;
    });
    this.modifiers.forEach(function (e) {
      if (e.enabled && s(e.onLoad)) {
        e.onLoad(r.reference, r.popper, r.options, e, r.state);
      }
    });
    this.update();
    var o = this.options.eventsEnabled;
    if (o) {
      this.enableEventListeners();
    }
    this.state.eventsEnabled = o;
  }
  w(e, [{
    key: "update",
    value: function () {
      return function () {
        if (!this.state.isDestroyed) {
          var e = {
            instance: this,
            styles: {},
            arrowStyles: {},
            attributes: {},
            flipped: false,
            offsets: {}
          };
          e.offsets.reference = C(this.state, this.popper, this.reference);
          e.placement = P(this.options.placement, e.offsets.reference, this.popper, this.reference, this.options.modifiers.flip.boundariesElement, this.options.modifiers.flip.padding);
          e.originalPlacement = e.placement;
          e.offsets.popper = L(this.popper, e.offsets.reference, e.placement);
          e.offsets.popper.position = "absolute";
          e = A(this.modifiers, e);
          if (this.state.isCreated) {
            this.options.onUpdate(e);
          } else {
            this.state.isCreated = true;
            this.options.onCreate(e);
          }
        }
      }.call(this);
    }
  }, {
    key: "destroy",
    value: function () {
      return function () {
        this.state.isDestroyed = true;
        if (D(this.modifiers, "applyStyle")) {
          this.popper.removeAttribute("x-placement");
          this.popper.style.left = "";
          this.popper.style.position = "";
          this.popper.style.top = "";
          this.popper.style[N("transform")] = "";
        }
        this.disableEventListeners();
        if (this.options.removeOnDestroy) {
          this.popper.parentNode.removeChild(this.popper);
        }
        return this;
      }.call(this);
    }
  }, {
    key: "enableEventListeners",
    value: function () {
      return function () {
        if (!this.state.eventsEnabled) {
          this.state = F(this.reference, this.options, this.state, this.scheduleUpdate);
        }
      }.call(this);
    }
  }, {
    key: "disableEventListeners",
    value: function () {
      return B.call(this);
    }
  }]);
  return e;
}();
$.Utils = (typeof window != "undefined" ? window : e).PopperUtils;
$.placements = V;
$.Defaults = Y;
exports.default = $;