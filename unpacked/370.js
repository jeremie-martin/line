Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.costOf = function (e) {
  var t = 0;
  var n = 0;
  if (e instanceof a) {
    t = 4;
    n = 6;
    const r = f(e.p1);
    const i = f(e.p2);
    t += r.verts;
    n += r.indices;
    t += i.verts;
    n += i.indices;
  } else if (e instanceof s) {
    t = 3;
    n = 3;
  } else if (e instanceof r.default) {
    t = 3;
    n = 3;
  } else {
    if (!(e instanceof i.default)) {
      throw new Error("don't know about this entity type");
    }
    t = 4;
    n = 6;
  }
  return {
    verts: t,
    indices: n
  };
};
exports.generate = function (e, t, n) {
  if (e instanceof a) {
    (function (e, t, n) {
      const r = e.p1.x;
      const i = e.p1.y;
      const o = e.p2.x;
      const a = e.p2.y;
      const s = o - r;
      const l = a - i;
      let u = Math.sqrt(s * s + l * l);
      if (u === 0) {
        u = 0.001;
      }
      const c = e.p1.thickness / 2;
      const d = e.p2.thickness / 2;
      const f = s / u * c;
      const h = l / u * c;
      const m = s / u * d;
      const y = l / u * d;
      const g = -h;
      const v = f;
      const b = -y;
      const _ = m;
      var w = g / c;
      var x = v / c;
      var E = b / d;
      var S = _ / d;
      const T = t(r + g, i + v, r, i, c, w, x, 10, 0, e.p1.colorA, e.p1.colorB);
      const k = t(o + b, a + _, o, a, d, E, S, 10, 0, e.p2.colorA, e.p2.colorB);
      const O = t(o - b, a - _, o, a, d, -E, -S, 11, 0, e.p2.colorA, e.p2.colorB);
      const P = t(r - g, i - v, r, i, c, -w, -x, 11, 0, e.p1.colorA, e.p1.colorB);
      n(T, k, O, T, O, P);
      p(e.p1, -f, -h, T, P, t, n, -1);
      p(e.p2, m, y, O, k, t, n, 1);
    })(e, t, n);
  } else if (e instanceof s) {
    (function (e, t, n) {
      var r = c(e.p1, e.p2, e.p3);
      var i = c(e.p2, e.p3, e.p1);
      var o = c(e.p3, e.p1, e.p2);
      var a = d(e.p1, e.p2, e.p3);
      var s = d(e.p2, e.p3, e.p1);
      var l = d(e.p3, e.p1, e.p2);
      var f = t(e.p1.x, e.p1.y, e.p1.x, e.p1.y, u, r.x, r.y, 2, a, e.p1.color, e.p1.color);
      var p = t(e.p2.x, e.p2.y, e.p2.x, e.p2.y, u, i.x, i.y, 3, s, e.p2.color, e.p2.color);
      var h = t(e.p3.x, e.p3.y, e.p3.x, e.p3.y, u, o.x, o.y, 5, l, e.p3.color, e.p3.color);
      const m = e.p2.x - e.p1.x;
      const y = e.p2.y - e.p1.y;
      const g = e.p3.x - e.p1.x;
      const v = e.p3.y - e.p1.y;
      if (m * v - y * g < 0) {
        n(f, p, h);
      } else {
        n(f, h, p);
      }
    })(e, t, n);
  } else if (e instanceof r.default) {
    (function (e, t, n) {
      let r = e.getClippingTriangle();
      let i = r.center;
      let o = r.primary;
      let a = r.secondary;
      var s = c(i, o, a);
      var l = c(o, a, i);
      var u = c(a, i, o);
      var f = d(i, o, a);
      var p = d(o, a, i);
      var h = d(a, i, o);
      var m = t(i.x, i.y, i.x, i.y, e.radius, s.x, s.y, 2, f, e.color, e.color);
      var y = t(o.x, o.y, i.x, i.y, e.radius, l.x, l.y, 3, p, e.color, e.color);
      var g = t(a.x, a.y, i.x, i.y, e.radius, u.x, u.y, 5, h, e.color, e.color);
      n(m, y, g);
    })(e, t, n);
  } else {
    if (!(e instanceof i.default)) {
      throw new Error("don't know about this entity type");
    }
    (function (e, t, n) {
      var r = c(e.p1, e.p2, e.p4);
      var i = c(e.p2, e.p3, e.p1);
      var o = c(e.p3, e.p4, e.p2);
      var a = c(e.p4, e.p1, e.p3);
      var s = d(e.p1, e.p2, e.p4);
      var l = d(e.p2, e.p3, e.p1);
      var f = d(e.p3, e.p4, e.p2);
      var p = d(e.p4, e.p1, e.p3);
      var h = t(e.p1.x, e.p1.y, e.p1.x, e.p1.y, u, r.x, r.y, 2, s, e.p1.color, e.p1.color);
      var m = t(e.p2.x, e.p2.y, e.p2.x, e.p2.y, u, i.x, i.y, 6, l, e.p2.color, e.p2.color);
      var y = t(e.p3.x, e.p3.y, e.p3.x, e.p3.y, u, o.x, o.y, 5, f, e.p3.color, e.p3.color);
      var g = t(e.p4.x, e.p4.y, e.p4.x, e.p4.y, u, a.x, a.y, 6, p, e.p4.color, e.p4.color);
      n(h, m, y, h, y, g);
    })(e, t, n);
  }
};
var r = o(require("./366.js"));
var i = o(require("./167.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var a = require("./61.js");
var s = require("./368.js");
var l = require("./371.js");
const u = 1024;
function c(e, t, n) {
  var r = t.x - e.x;
  var i = t.y - e.y;
  var o = r + (n.x - e.x);
  var a = i + (n.y - e.y);
  o *= -1;
  a *= -1;
  var s = Math.sqrt(o * o + a * a);
  return {
    x: o / s,
    y: a / s
  };
}
function d(e, t, n) {
  var r = (t.x + n.x) / 2;
  var i = (t.y + n.y) / 2;
  var o = r - e.x;
  var a = i - e.y;
  return Math.sqrt(o * o + a * a);
}
function f(e) {
  if (!e.cap) {
    return {
      verts: 2,
      indices: 6
    };
  }
  switch (e.cap.type) {
    case l.LINECAP_TYPE_ROUNDED:
    case l.LINECAP_TYPE_HALF_ROUNDED_EXTRUSION:
      return {
        verts: 2,
        indices: 6
      };
    default:
      return {
        verts: 0,
        indices: 0
      };
  }
}
function p(e, t, n, r, i, o, a, s) {
  if (e.cap) {
    switch (e.cap.type) {
      case l.LINECAP_TYPE_ROUNDED:
        h(e, t, n, r, i, o, a, s);
        break;
      case l.LINECAP_TYPE_HALF_ROUNDED_EXTRUSION:
        (function (e, t, n, r, i, o, a, s) {
          let l = e.x;
          let u = e.y;
          let f = -n * s;
          let p = t * s;
          let h = e.thickness;
          let m = l + f;
          let y = u + p;
          let g = m - f * 2 * Math.SQRT2;
          let v = y - p * 2 * Math.SQRT2;
          let b = m + t * 2 * Math.SQRT2;
          let _ = y + n * 2 * Math.SQRT2;
          let w = {
            x: m,
            y: y
          };
          let x = {
            x: b,
            y: _
          };
          let E = {
            x: g,
            y: v
          };
          var S = c(w, x, E);
          var T = c(x, E, w);
          var k = c(E, w, x);
          var O = d(w, x, E);
          var P = d(x, E, w);
          var C = d(E, w, x);
          var r = o(w.x, w.y, w.x, w.y, h, S.x, S.y, 2, O, e.colorA, e.colorB);
          var i = o(x.x, x.y, w.x, w.y, h, T.x, T.y, 3, P, e.colorA, e.colorB);
          var I = o(E.x, E.y, w.x, w.y, h, k.x, k.y, 5, C, e.colorA, e.colorB);
          a(r, i, I);
        })(e, t, n, r, i, o, a, s);
    }
  } else {
    h(e, t, n, r, i, o, a, s);
  }
}
function h(e, t, n, r, i, o, a, s) {
  var l = e.x;
  var u = e.y;
  var c = -n;
  var d = t;
  var f = e.thickness / 2;
  var p = t + c;
  var h = n + d;
  var m = Math.sqrt(p * p + h * h);
  p = p / m * 1.414213;
  h = h / m * 1.414213;
  var y = t - c;
  var g = n - d;
  var v = Math.sqrt(y * y + g * g);
  y = y / v * 1.414213;
  g = g / v * 1.414213;
  let b = 10;
  let _ = 11;
  if (s < 0) {
    b = 11;
    _ = 10;
  }
  var w = o(l + t + c, u + n + d, l, u, f, p, h, b, 0, e.colorA, e.colorB);
  var x = o(l + t - c, u + n - d, l, u, f, y, g, _, 0, e.colorA, e.colorB);
  a(x, r, i, x, i, w);
}