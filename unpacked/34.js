function r(e) {
  return "data:image/svg+xml;base64," + window.btoa(e);
}
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getActionName = function (e) {
  let t = e.type;
  if (e.meta) {
    if (e.meta.name) {
      t = e.meta.name;
    }
    if (e.meta.id) {
      t += "#" + e.meta.id;
    }
    if (e.error) {
      t += ".error";
    }
  }
  return t;
};
exports.delay = function (e, t) {
  return new Promise(n => setTimeout(() => n(t), e));
};
exports.animationFrame = function (e, t = false) {
  let n;
  let r;
  let i = new Promise(t => {
    n = requestAnimationFrame(() => t(e));
  });
  if (t) {
    return i;
  }
  let o = new Promise(t => {
    r = setTimeout(() => t(e), 1000 / 30);
  });
  let a = Promise.race([i, o]);
  a.then(() => {
    cancelAnimationFrame(n);
    clearTimeout(r);
  });
  return a;
};
exports.rafThrottle = function (e) {
  let t;
  let n;
  function r() {
    e(...n);
    t = null;
  }
  function i(...e) {
    n = e;
    if (t == null) {
      t = window.requestAnimationFrame(r);
    }
  }
  i.cancel = () => window.cancelAnimationFrame(t);
  i.flush = () => {
    if (t != null) {
      window.cancelAnimationFrame(t);
      r();
    }
  };
  return i;
};
exports.encodeOptimizedSVGDataUri = r;
exports.toSvgCursorString = function (e, t = 1) {
  return r(`<svg xmlns="http://www.w3.org/2000/svg" width="${t * 24}" height="${t * 24}" viewBox="0 0 24 24">${`<path stroke="white" stroke-width="2" opacity="0.8" d="${e}" />`}${`<path fill="black" d="${e}" />`}</svg>`);
};
exports.toLineArray = function ({
  type: e,
  id: t,
  x1: n,
  y1: r,
  x2: s,
  y2: l,
  leftExtended: u,
  rightExtended: c,
  flipped: d,
  leftLine: f,
  rightLine: p
}) {
  let h = [e, t, n, r, s, l];
  if (a(e)) {
    let e = (u && i) | (c && o);
    h = h.concat([e, d | 0]);
    if (f) {
      h[8] = f;
    }
    if (p) {
      h[8] = typeof h[8] == "number" ? h[8] : null;
      h[9] = p;
    }
  }
  return h;
};
const i = 1;
const o = 2;
const a = e => e === 0 || e === 1;