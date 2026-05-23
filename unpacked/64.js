function r(e) {
  return Math.sqrt(e.x * e.x + e.y * e.y);
}
function i(e) {
  return e.x * e.x + e.y * e.y;
}
function o(e) {
  return Math.atan2(e.y, e.x);
}
function a(e, t) {
  return o(t) - o(e);
}
function s(e, t) {
  const n = t.x - e.x;
  const r = t.y - e.y;
  return Math.sqrt(n * n + r * r);
}
function l(e, t) {
  const n = t.x - e.x;
  const r = t.y - e.y;
  return n * n + r * r;
}
function u(e, t) {
  return e.x * t.x + e.y * t.y;
}
function c(e, t) {
  return e.x * t.y - e.y * t.x;
}
function d(e, t) {
  return e.x === t.x && e.y === t.y;
}
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.len = r;
exports.lenSq = i;
exports.angle = o;
exports.angleTo = a;
exports.dist = s;
exports.distSq = l;
exports.dot = u;
exports.cross = c;
exports.equals = d;
const f = {
  len: r,
  lenSq: i,
  angle: o,
  angleTo: a,
  dist: s,
  distSq: l,
  dot: u,
  cross: c,
  equals: d
};
const p = {
  add(e) {
    this.x += e.x;
    this.y += e.y;
    return this;
  },
  sub(e) {
    this.x -= e.x;
    this.y -= e.y;
    return this;
  },
  mul(e) {
    this.x *= e;
    this.y *= e;
    return this;
  },
  div(e) {
    this.x /= e;
    this.y /= e;
    return this;
  },
  norm() {
    this.div(this.len());
    return this;
  },
  rot(e) {
    const t = Math.cos(e);
    const n = Math.sin(e);
    const r = this.x;
    const i = this.y;
    this.x = r * t - i * n;
    this.y = r * n + i * t;
    return this;
  },
  rotCW() {
    const e = this.x;
    const t = this.y;
    this.x = -t;
    this.y = e;
    return this;
  },
  rotCCW() {
    const e = this.x;
    const t = this.y;
    this.x = t;
    this.y = -e;
    return this;
  }
};
for (let m in f) {
  let e = f[m];
  p[m] = function (t) {
    return e(this, t);
  };
}
function h(e) {
  let t = Object.create(p);
  t.x = e.x;
  t.y = e.y;
  return t;
}
Object.assign(h, f);
exports.default = h;