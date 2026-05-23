function r(e, t, n) {
  if (t >= 1) {
    return 0;
  }
  let r;
  let i = 1 - t;
  let o = (1 + t) * (1 - n);
  if (e > o) {
    r = 1;
    if (n > 0 || t > 0) {
      let t = 1 - i * o;
      r *= 1 - t * Math.exp(i / t * (-e + o));
    }
  } else {
    r = e * i;
  }
  return r;
}
function i(e, {
  rx: t,
  ry: n
}, {
  pull: i,
  push: o
}) {
  let a = o * (t > n ? n : t);
  t -= a;
  n -= a;
  let s;
  let l;
  let u;
  let c;
  let d;
  let f = e.x / t;
  let p = e.y / n;
  let h = f * f + p * p;
  if (h <= 1) {
    h = Math.sqrt(h);
    f = e.x / h;
    p = e.y / h;
    s = Math.sqrt(f * f + p * p);
    l = Math.sqrt(e.x * e.x + e.y * e.y);
  } else {
    var m = function (e, t, n = 2) {
      let r = Math.atan2(t.rx * e.y, t.ry * e.x);
      let i = e.x * t.rx;
      let o = e.y * t.ry;
      let a = t.rx * t.rx - t.ry * t.ry;
      for (let s = 0; s < n; s++) {
        let e = Math.cos(r);
        let t = Math.sin(r);
        r -= (a * e * t - i * t + o * e) / (a * (e * e - t * t) - i * e - o * t);
      }
      return {
        x: t.rx * Math.cos(r),
        y: t.ry * Math.sin(r)
      };
    }(e, {
      rx: t,
      ry: n
    });
    f = m.x;
    p = m.y;
    c = e.x - f;
    d = e.y - p;
    s = Math.sqrt(f * f + p * p);
    l = (u = Math.sqrt(c * c + d * d)) + s;
  }
  let y = a + s;
  let g = a / y;
  let v = r(h = l / y, i, g);
  if (v <= 1 - g) {
    return {
      x: f * v * y / s,
      y: p * v * y / s
    };
  }
  {
    let e = (v - (1 - g)) / g;
    return {
      x: c * e * a / u + f,
      y: d * e * a / u + p
    };
  }
}
Object.defineProperty(exports, "__esModule", {
  value: true
});
const o = {
  maxZoom: 32,
  pull: 0.01,
  push: 0.8,
  roundness: 0.5,
  squareness: 0
};
var a;
a = function (e, {
  rx: t,
  ry: n
}, o) {
  let a = o.squareness;
  let s = o.roundness;
  if (t > n) {
    t = a * n + (1 - a) * t;
  } else {
    n = a * t + (1 - a) * n;
  }
  let l = i(e, {
    rx: t,
    ry: n
  }, o);
  let u = function ({
    x: e,
    y: t
  }, {
    rx: n,
    ry: i
  }, {
    pull: o,
    push: a
  }) {
    return {
      x: Math.sign(e) * n * r(Math.abs(e) / n, o, a),
      y: Math.sign(t) * i * r(Math.abs(t) / i, o, a)
    };
  }(e, {
    rx: t,
    ry: n
  }, o);
  return {
    x: s * l.x + (1 - s) * u.x,
    y: s * l.y + (1 - s) * u.y
  };
};
exports.default = (e, {
  x: t,
  y: n
}, {
  zoom: r,
  width: i,
  height: s,
  widthScale: l = 0.4,
  heightScale: u = 0.4
}, c = o) => {
  let d = c.pull;
  let f = c.maxZoom;
  if (r < f) {
    i = Math.min(i, s * 2);
    s = Math.min(s, i * 2);
    let e = 2 - 2 / (2 - r / f);
    i *= e * l / r;
    s *= e * u / r;
  } else {
    i = 0;
    s = 0;
  }
  let p = {
    x: t - e.x,
    y: n - e.y
  };
  if (p.x === 0 && p.y === 0) {
    return Object.assign({
      w: i,
      h: s
    }, e);
  }
  if (d === 1 || i + s === 0) {
    return {
      x: t,
      y: n
    };
  }
  let h = a(p, {
    rx: i / 2,
    ry: s / 2
  }, c);
  return {
    w: i,
    h: s,
    dx: 0,
    dy: 0,
    x: e.x + p.x - h.x,
    y: e.y + p.y - h.y
  };
};
module.exports = exports.default;