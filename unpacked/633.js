Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = function () {
  return function (e, t) {
    if (Array.isArray(e)) {
      return e;
    }
    if (Symbol.iterator in Object(e)) {
      return function (e, t) {
        var n = [];
        var r = true;
        var i = false;
        var o = undefined;
        try {
          for (var a, s = e[Symbol.iterator](); !(r = (a = s.next()).done) && (n.push(a.value), !t || n.length !== t); r = true);
        } catch (e) {
          i = true;
          o = e;
        } finally {
          try {
            if (!r && s.return) {
              s.return();
            }
          } finally {
            if (i) {
              throw o;
            }
          }
        }
        return n;
      }(e, t);
    }
    throw new TypeError("Invalid attempt to destructure non-iterable instance");
  };
}();
function i(e) {
  if (Array.isArray(e)) {
    return e;
  } else {
    return Array.from(e);
  }
}
exports.default = function (e) {
  window.createZoomer = d((e, t, n) => {
    if (!Number.isFinite(t)) {
      throw new Error(`${e} zoom (${t}) should be a number: ${n}`);
    }
  }, l, u, e => {
    const t = t => Math.pow(2, e[Math.min(t, e.length - 1)]);
    return e => c(t(Math.floor(e)), t(Math.ceil(e)), e % 1);
  });
  Object.defineProperty(window.createZoomer, "help", {
    get() {
      console.log(h);
    }
  });
  window.createBoundsPanner = d((e, t, n) => {
    if (!Number.isFinite(t.x)) {
      throw new Error(`${e} x (${t.x}) should be a number: ${n}`);
    }
    if (!Number.isFinite(t.y)) {
      throw new Error(`${e} y (${t.y}) should be a number: ${n}`);
    }
    if (!Number.isFinite(t.w)) {
      throw new Error(`${e} w (${t.w}) should be a number: ${n}`);
    }
    if (!Number.isFinite(t.h)) {
      throw new Error(`${e} h (${t.h}) should be a number: ${n}`);
    }
    if (!Number.isFinite(t.px)) {
      throw new Error(`${e} px (${t.px}) should be a number: ${n}`);
    }
    if (!Number.isFinite(t.py)) {
      throw new Error(`${e} py (${t.py}) should be a number: ${n}`);
    }
  }, (e, t, n, i) => {
    var o = ["x", "y", "w", "h", "px", "py"].map(r => l(e, t, n[r], i[r]));
    var a = r(o, 6);
    const s = a[0];
    const u = a[1];
    const c = a[2];
    const d = a[3];
    const f = a[4];
    const p = a[5];
    const h = [];
    for (let r = 0; r < s.length; r++) {
      h.push({
        x: s[r],
        y: u[r],
        w: c[r],
        h: d[r],
        px: f[r],
        py: p[r]
      });
    }
    return h;
  }, (e, t) => {
    var n = ["x", "y", "w", "h", "px", "py"].map(t => e.map(e => e[t])).map(e => u(e, t));
    var i = r(n, 6);
    let o = i[0];
    let a = i[1];
    let s = i[2];
    let l = i[3];
    let c = i[4];
    let d = i[5];
    const f = [];
    for (let r = 0; r < o.length; r++) {
      f.push({
        x: o[r],
        y: a[r],
        w: s[r],
        h: l[r],
        px: c[r],
        py: d[r]
      });
    }
    return f;
  }, e => t => {
    const n = e[Math.min(t, e.length - 1)];
    return n;
  });
  Object.defineProperty(window.createBoundsPanner, "help", {
    get() {
      console.log(p);
    }
  });
  window.createFocuser = d((e, t, n) => {
    const r = a();
    for (let i = 0; i < r; i++) {
      if (!(t[i] >= 0)) {
        throw new Error(`${e} ${i} (${t[i]}) should be a non-negative number: ${n}`);
      }
    }
  }, (e, t, n, r) => {
    const i = Array(a()).fill().map((e, t) => t);
    const o = i.map(i => l(e, t, n[i], r[i]));
    const s = [];
    for (let a = 0; a < o[0].length; a++) {
      s.push(o.map(e => e[a]));
    }
    return s;
  }, (e, t) => {
    const n = Array(a()).fill().map((e, t) => t);
    let r = n.map(t => e.map(e => e[t])).map(e => u(e, t));
    const i = [];
    for (let o = 0; o < r[0].length; o++) {
      i.push(r.map(e => e[o]));
    }
    return i;
  }, e => t => {
    const n = e[Math.min(t, e.length - 1)];
    return n;
  });
  Object.defineProperty(window.createFocuser, "help", {
    get() {
      console.log(m);
    }
  });
  window.createTimeRemapper = (e, t = false) => {
    s(e, (e, t, n) => {
      if (!Number.isFinite(t)) {
        throw new Error(`${e} speed (${t}) should be a number: ${n}`);
      }
      if (!(t > 0)) {
        throw new Error(`${e} speed (${t}) should greater than zero: ${n}`);
      }
    }, {
      strictInteger: false,
      strictIncreasing: false
    });
    const n = o();
    var a = e;
    var l = i(a);
    var u = r(l[0], 2);
    let d = u[1];
    let f = l.slice(1);
    e = [[0, 0, d]];
    for (let i of f) {
      var p = r(i, 2);
      let o = p[0];
      let a = p[1];
      if (o instanceof Array) {
        var h = [...o].reverse();
        var m = r(h, 3);
        let e = m[0];
        var y = m[1];
        let t = y === undefined ? 0 : y;
        var g = m[2];
        let i = g === undefined ? 0 : g;
        o = e + n * (t + i * 60);
      }
      var v = r(e[e.length - 1], 3);
      let s = v[0];
      let l = v[1];
      let u = v[2];
      const c = o / n;
      let d;
      if (t) {
        const e = (a + u) / 2;
        d = l + (c - s) / e;
      } else {
        d = l + (c - s) / u;
      }
      e.push([c, d, a]);
    }
    return {
      physicsToReal: n => {
        if (n <= 0) {
          return 0;
        }
        const i = e.findIndex(([e, t, r]) => n < e);
        if (i === -1) {
          var o = r(e[e.length - 1], 3);
          const t = o[0];
          const i = o[1];
          const a = o[2];
          const s = (n - t) / a;
          return i + s;
        }
        var a = r(e[i - 1], 3);
        const s = a[0];
        const l = a[1];
        const u = a[2];
        var d = r(e[i], 3);
        const f = d[0];
        const p = d[1];
        const h = d[2];
        const m = f - s;
        const y = n - s;
        const g = y / m;
        if (!t || u === h) {
          return c(l, p, g);
        }
        const v = p - l;
        return l + (Math.sqrt(v * (v * u * u + y * 2 * (h - u))) - v * u) / (h - u);
      },
      realToPhysics: n => {
        if (n <= 0) {
          return 0;
        }
        const i = e.findIndex(([e, t, r]) => n < t);
        if (i === -1) {
          var o = r(e[e.length - 1], 3);
          const t = o[0];
          const i = o[1];
          const a = o[2];
          const s = (n - i) * a;
          return t + s;
        }
        var a = r(e[i - 1], 3);
        const s = a[0];
        const l = a[1];
        const u = a[2];
        var d = r(e[i], 3);
        const f = d[0];
        const p = d[1];
        const h = d[2];
        const m = p - l;
        const y = n - l;
        const g = y / m;
        if (!t || u === h) {
          return c(s, f, g);
        }
        const v = s + y * (u + y * (h - u) / 2 / m);
        return v;
      }
    };
  };
  Object.defineProperty(window.createTimeRemapper, "help", {
    get() {
      console.log(f);
    }
  });
};
const o = () => window.store.getState().player.settings.fps;
const a = () => window.store.getState().simulator.engine.engine.state.riders.length;
function s(e, t, {
  strictInteger: n = true,
  strictIncreasing: i = true
} = {}) {
  if (!(e instanceof Array)) {
    throw new Error(`Keyframes should be an array: ${JSON.stringify(e)}`);
  }
  if (e.length < 1) {
    throw new Error(`Keyframes should not be empty: ${JSON.stringify(e)}`);
  }
  e.reduce((e, a, s) => {
    let l = JSON.stringify(a);
    let u = `Keyframe #${s}`;
    if (!(a instanceof Array)) {
      throw new Error(`${u} should be an array: ${l}`);
    }
    var c = r(a, 2);
    let d = c[0];
    let f = c[1];
    if (d instanceof Array) {
      var p = [...d].reverse();
      var h = r(p, 3);
      let e = h[0];
      var m = h[1];
      let t = m === undefined ? 0 : m;
      var y = h[2];
      let i = y === undefined ? 0 : y;
      switch (d.length) {
        case 3:
          if (!Number.isInteger(i)) {
            throw new Error(`${u} index minutes (${i}) should be an integer: ${l}`);
          }
        case 2:
          if (n && !Number.isInteger(t)) {
            throw new Error(`${u} index seconds (${t}) should be an integer: ${l}`);
          }
        case 1:
          if (n && !Number.isInteger(e)) {
            throw new Error(`${u} index frames (${e}) should be an integer: ${l}`);
          }
          break;
        case 0:
        default:
          throw new Error(`${u} index (${JSON.stringify(d)}) should be [frames], [sec,frames], or [min,sec,frames]: ${l}`);
      }
      d = e + o() * (t + i * 60);
    }
    if (!Number.isInteger(d)) {
      throw new Error(`${u} index (${d}) should be an integer: ${l}`);
    }
    if (i) {
      if (d <= e) {
        throw new Error(`${u} index (${d}) should be greater than the previous index (${e}): ${l}`);
      }
    } else if (d < e) {
      throw new Error(`${u} index (${d}) should be greater than or equal to the previous index (${e}): ${l}`);
    }
    t(u, f, l);
    if (s === 0 && d !== 0) {
      throw new Error(`The first keyframe index (${d}) should be 0: ${l}`);
    }
    return d;
  }, -1);
}
function l(e, t, n, r) {
  let i = t - e;
  let o = (r - n) / i;
  let a = [];
  for (let s = 1; s < i; s++) {
    a.push(o * s + n);
  }
  return a;
}
function u(e, t) {
  if (t === 0) {
    return e;
  }
  e = [...e, ...Array(t).fill(e[e.length - 1])];
  let n = t;
  let r = t + 1 + t;
  let i = Array(r).fill().map((e, t) => Math.cos(Math.PI * (t - n) / r));
  let o = i.reduce((e, t) => e + t, 0);
  i = i.map(e => e / o);
  return e.map((t, r) => i.reduce((t, i, o) => t + i * e[(t => Math.max(0, Math.min(e.length - 1, t)))(r + o - n)], 0));
}
function c(e, t, n) {
  return e + (t - e) * n;
}
function d(e, t, n, a) {
  return function (l, u = 20) {
    s(l, e);
    if (!Number.isInteger(u) || u < 0) {
      throw new Error(`Smoothing should be a positive integer: ${u}`);
    }
    var c = i(l);
    let d = r(c[0], 2)[1];
    let f = c.slice(1);
    const p = o();
    let h = f.reduce((e, [n, i], o) => {
      let a = e.length - 1;
      let s = e[a];
      if (n instanceof Array) {
        var l = [...n].reverse();
        var u = r(l, 3);
        let e = u[0];
        var c = u[1];
        let t = c === undefined ? 0 : c;
        var d = u[2];
        n = e + p * (t + (d === undefined ? 0 : d) * 60);
      }
      return [...e, ...t(a, n, s, i), i];
    }, [d]);
    h = n(h, u);
    return a(h);
  };
}
const f = "\nUsage: timeRemapper = createTimeRemapper(keyframes, [interpolate])\n\nkeyframes:\n[\n  [0, speed0],\n  [index1, speed1],\n  [[seconds, frames], speed2],\n  [[minutes, seconds, frames], speed3],\n  keyframe4,\n  ...\n]\n\nExample:\ntimeRemapper = createTimeRemapper([\n  [0, 1],\n  [[1,0], 1/4],\n  [[2,0], 1]\n])\n\nExample with interpolation:\ntimeRemapper = createTimeRemapper([\n  [0, 1],\n  [[1,0], 1],\n  [[2,0], 1/8],\n  [[2,20], 1/8],\n  [[2,20], 1] // for jumps\n], true)\n";
const p = "\nUsage: getCamBounds = createBoundsPanner(keyframes, [smoothing])\n\nkeyframes:\n[\n  [0, bounds0],\n  [index1, bounds1],\n  [[seconds, frames], bounds2],\n  [[minutes, seconds, frames], bounds3],\n  keyframe4,\n  ...\n]\n\nbounds:\n{ w: width, h: height, x: x offset, y: y offset, px: exact x offset, py: exact y offset }\nwidth and height are from 0 to 1, 1 being the same width/height as the playback dimensions\nx and y are from -1 to 1, 1 being the width/height of the playback dimensions\npx and py are exact x and y offsets from the center, in pixels\n\nExample:\ngetCamBounds = createBoundsPanner([\n  [0, {w: 0.4, h: 0.4, x: 0, y: 0}],\n  [[2,0], {w: 0.4, h: 0.4, x: 0, y: 0}],\n  [[3,0], {w: 0.6, h: 0.4, x: 0, y: -0.3}],\n  [[4,0], {w: 0.6, h: 0.4, x: 0, y: -0.3}],\n  [[4,1], {w: 0, h: 0, x: 0, y: 0}]\n])\n";
const h = "\nUsage: getAutoZoom = createZoomer(keyframes, [smoothing])\n\nkeyframes:\n[\n  [0, zoom0],\n  [index1, zoom1],\n  [[seconds, frames], zoom2],\n  [[minutes, seconds, frames], zoom3],\n  keyframe4,\n  ...\n]\n\nExample:\ngetAutoZoom = createZoomer([[0, 0], [[2,0], 0], [[3,0], 4], [[4,0],4], [[4,1],1]])\n\nExample with no smoothing:\ngetAutoZoom = createZoomer([[0, 0], [40, 0], [60, 1], [80, 1], [81, 0]], 0)\n";
const m = "\nUsage: getCamFocus = createFocuser(keyframes, [smoothing])\n\nWhen panning large distances between riders,\nit might be a good idea to use more smoothing\n\nkeyframes:\n[\n  [0, weights0],\n  [index1, weights1],\n  [[seconds, frames], weights2],\n  [[minutes, seconds, frames], weights3],\n  keyframe4,\n  ...\n]\n\nweights:\n3 element array of weights corresponding to each rider.\nThe camera focuses on the weighted average of the rider positions:\n[1, 0, 0]: only the first rider\n[0, 1, 0]: only the second rider\n[0, 0, 1]: only the third rider\n[1, 1, 0]: the position halfway between the first and second rider\n[1, 1, 1]: the average position of all the riders\n[1, 0.5, 0]: the position between the first and second rider,\n  weighted towards the first rider by a ratio of 2:1\n(fractional weights are used by keyframe interpolation to\n  smoothly pan towards the next rider)\n";
module.exports = exports.default;