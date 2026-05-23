function r(e, t, n, r, i, o, a, s, l) {
  const u = n - e;
  const c = r - t;
  const d = a - i;
  const f = s - o;
  const p = u * f - d * c;
  if (p === 0) {
    return !!l || null;
  }
  const h = p > 0;
  const m = i - e;
  const y = o - t;
  const g = m * c - y * u;
  if (g === 0 ? !l : g < 0 === h) {
    return null;
  }
  const v = m * f - y * d;
  if ((v === 0 ? l : v < 0 !== h) && (g === p ? l : g > p !== h) && (v === p ? l : v > p !== h)) {
    return v / p;
  } else {
    return null;
  }
}
function i(e, t, n, i, o, a, s, l, u) {
  let c;
  let d;
  let f;
  let p;
  let h;
  let m;
  let y;
  let g;
  if (u) {
    c = e < o;
    d = e > s;
    f = t < a;
    p = t > l;
    h = n < o;
    m = n > s;
    y = i < a;
    g = i > l;
  } else {
    c = e <= o;
    d = e >= s;
    f = t <= a;
    p = t >= l;
    h = n <= o;
    m = n >= s;
    y = i <= a;
    g = i >= l;
  }
  return (!c || !h) && (!d || !m) && (!f || !y) && (!p || !g) && (!c && !d && (!f && !p || !h && !m) || !y && !g && (!h && !m || !f && !p) || ((c || p || m || y) && (d || f || h || g) ? r(e, t, n, i, o, l, s, a, u) !== null : r(e, t, n, i, o, a, s, l, u) !== null));
}
function o(e, t, n, r, i, o) {
  const a = i - n;
  const s = o - r;
  const l = e - n;
  const u = t - r;
  const c = l * a + u * s;
  if (c <= 0) {
    return l * l + u * u;
  }
  const d = a * a + s * s;
  if (c >= d) {
    const n = e - i;
    const r = t - o;
    return n * n + r * r;
  }
  const f = l * s - u * a;
  return f * f / d;
}
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.lineLineIntersection = r;
exports.lineInBox = function (e, t, n, r, o, a, s, l, u) {
  if (o < s) {
    if (a < l) {
      return i(e, t, n, r, o, a, s, l, u);
    } else {
      return i(e, t, n, r, o, l, s, a, u);
    }
  } else if (a < l) {
    return i(e, t, n, r, s, a, o, l, u);
  } else {
    return i(e, t, n, r, s, l, o, a, u);
  }
};
exports.lineInBoxOrdered = i;
exports.pointLineDistance = function (e, t, n, r, i, a) {
  return Math.sqrt(o(e, t, n, r, i, a));
};
exports.pointLineDistanceSquared = o;