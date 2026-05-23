Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hasClipboard = exports.hasSelection = exports.getSelectToolState = exports.setSelectToolState = exports.LINE_ADJUST_THRESHOLD = exports.POINT_RADIUS = exports.LINE_WIDTH = exports.Status = undefined;
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
exports.getSinglePointFromPoints = function (e, t) {
  let n;
  for (let r of e) {
    if (e.has(r ^ 1)) {
      return null;
    }
    if (!n || t.size > 0 && t.has(r)) {
      n = r;
    }
  }
  return n;
};
exports.getLineFromPoints = function (e) {
  if (e.size === 2) {
    var t = e.values();
    var n = r(t, 2);
    let i = n[0];
    let o = n[1];
    if (i >> 1 == o >> 1) {
      return i >> 1;
    }
  }
  return null;
};
exports.getLinePointsFromPoints = m;
exports.getLinesFromPoints = y;
exports.getBoundingBox = function (e, t) {
  if (t.size === 0) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    };
  }
  let n = Infinity;
  let r = Infinity;
  let i = -Infinity;
  let o = -Infinity;
  for (let a of t) {
    let t = e.getLine(a);
    if (!t) {
      continue;
    }
    const s = t.width ? t.width : f / 2;
    n = Math.min(t.p1.x - s, n);
    r = Math.min(t.p1.y - s, r);
    i = Math.max(t.p1.x + s, i);
    o = Math.max(t.p1.y + s, o);
    n = Math.min(t.p2.x - s, n);
    r = Math.min(t.p2.y - s, r);
    i = Math.max(t.p2.x + s, i);
    o = Math.max(t.p2.y + s, o);
  }
  return {
    x: n,
    y: r,
    width: i - n,
    height: o - r
  };
};
exports.getBoundingBoxFromLines = function (e) {
  if (e.length === 0) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    };
  }
  let t = Infinity;
  let n = Infinity;
  let r = -Infinity;
  let i = -Infinity;
  for (let o of e) {
    t = Math.min(o.x1, t);
    n = Math.min(o.y1, n);
    r = Math.max(o.x1, r);
    i = Math.max(o.y1, i);
    t = Math.min(o.x2, t);
    n = Math.min(o.y2, n);
    r = Math.max(o.x2, r);
    i = Math.max(o.y2, i);
  }
  return {
    x: t,
    y: n,
    width: r - t,
    height: i - n
  };
};
exports.selectPoints = function (e, t, n) {
  let r = function (e, t, n) {
    let r;
    let i;
    let o = (0, u.getSimulatorCommittedTrack)(e);
    let l = (0, u.getEditorZoom)(e);
    let c = p / l * 1;
    let d = new Set();
    let f = c * c;
    const h = (e, o) => {
      let l = o ? e.p2 : e.p1;
      if (r && r.x === l.x && r.y === l.y) {
        if (n) {
          let n = (0, s.pointLineDistanceSquared)(t.x, t.y, e.p1.x, e.p1.y, e.p2.x, e.p2.y);
          if (n < i) {
            d.clear();
            d.add(e.id << 1 | o);
            i = n;
          }
        } else {
          d.add(e.id << 1 | o);
        }
      } else {
        let u = a.default.distSq(t, l);
        if (u < f) {
          f = u;
          r = l;
          d.clear();
          d.add(e.id << 1 | o);
          if (n) {
            i = (0, s.pointLineDistanceSquared)(t.x, t.y, e.p1.x, e.p1.y, e.p2.x, e.p2.y);
          }
        }
      }
    };
    let m = (0, u.getTrackLinesLocked)(e);
    for (let a of o.selectLinesInRadius(t, c)) {
      if (!m || !a.collidable) {
        h(a, false);
        h(a, true);
      }
    }
    return d;
  }(e, t, n);
  if (r.size > 0) {
    return r;
  }
  return function (e, t) {
    let n = (0, u.getSimulatorCommittedTrack)(e);
    (0, u.getEditorZoom)(e);
    let r = f * 2 / 2 * 1;
    let i = new Set();
    let o = Infinity;
    let a = null;
    let l = (0, u.getTrackLinesLocked)(e);
    for (let u of n.selectLinesInRadius(t, r)) {
      if (l && u.collidable) {
        continue;
      }
      let e = (0, s.pointLineDistanceSquared)(t.x, t.y, u.p1.x, u.p1.y, u.p2.x, u.p2.y);
      if (e < o || e === o && (!a || u.id > a.id)) {
        o = e;
        a = u;
      }
    }
    if (a) {
      i.add(a.id << 1 | false);
      i.add(a.id << 1 | true);
    }
    return i;
  }(e, t);
};
exports.filterNonCollidingPoints = function (e, t) {
  let n = (0, u.getSimulatorCommittedTrack)(e);
  return new Set([...t].filter(e => {
    let t = n.getLine(e >> 1);
    return t && !t.collidable;
  }));
};
exports.copyLinesFromPoints = function (e, t, n, r) {
  let i = (0, u.getSimulatorCommittedTrack)(e);
  let o = (0, u.getEditorPosition)(e);
  let a = [...y(t)].sort();
  let s = [];
  for (let l of a) {
    let e = i.getLine(l);
    if (e) {
      e = e.toJSON();
      if (!r) {
        delete e.id;
      }
      if (n) {
        e.x1 -= o.x;
        e.y1 -= o.y;
        e.x2 -= o.x;
        e.y2 -= o.y;
      }
      s.push(e);
    }
  }
  return s;
};
exports.createCopiedSelection = function (e, t) {
  const n = new Set();
  for (const i of t) {
    n.add(i.layer || 0);
  }
  const r = (0, u.getTrackLayers)(e).filter(e => n.has(e.id));
  return {
    lines: t,
    layers: r
  };
};
exports.nudgeLineRelatively = function (e, t, n, i) {
  let o = (0, u.getSimulatorTrack)(e);
  var s = [...t].sort();
  var l = r(s, 2);
  let c = l[0];
  let d = l[1];
  if (c == null) {
    return;
  }
  let f;
  let p;
  let h = c >> 1;
  let m = o.getLine(h);
  let y = m.norm;
  let v = new a.default(m.norm).rotCCW().mul(n).add(new a.default(y).mul(i));
  if (d != null && d >> 1 === h) {
    p = h;
  } else {
    f = c;
  }
  return g(e, f, p, v);
};
exports.pasteLines = function (e, t) {
  let n = (0, u.getEditorPosition)(e);
  return t.map(e => {
    e.id;
    let t = function (e, t) {
      var n = {};
      for (var r in e) {
        if (!(t.indexOf(r) >= 0)) {
          if (Object.prototype.hasOwnProperty.call(e, r)) {
            n[r] = e[r];
          }
        }
      }
      return n;
    }(e, ["id"]);
    return Object.assign({}, t, {
      x1: t.x1 + n.x,
      y1: t.y1 + n.y,
      x2: t.x2 + n.x,
      y2: t.y2 + n.y
    });
  });
};
exports.pasteLayeredLines = function (e, t) {
  const n = (0, u.getTrackLayers)(e).toArray();
  const r = 1 + Math.max(...n.map(e => e.id));
  const i = {};
  const o = [];
  for (let s = 0; s < t.layers.length; s++) {
    i[t.layers[s].id] = s;
    o.push(t.layers[s].name);
  }
  const a = t.lines.map(e => Object.assign({}, e, {
    layer: i[e.layer || 0] + r
  }));
  return {
    newLayers: o,
    newLines: a
  };
};
exports.selectPointsFromBox = function (e, t, n, r) {
  let i = (0, u.getSimulatorCommittedTrack)(e);
  let o = new Set();
  let a = {
    x: Math.min(t.x, n.x),
    y: Math.min(t.y, n.y),
    width: Math.abs(t.x - n.x),
    height: Math.abs(t.y - n.y)
  };
  let s = (0, u.getTrackLinesLocked)(e);
  for (let l of i.selectLinesInRect(a)) {
    if (!s || !l.collidable) {
      if (r) {
        let e = l.p1;
        let t = l.p2;
        if (e.x > a.x && e.y > a.y && e.x < a.x + a.width && e.y < a.y + a.height) {
          o.add(l.id << 1 | false);
        }
        if (t.x > a.x && t.y > a.y && t.x < a.x + a.width && t.y < a.y + a.height) {
          o.add(l.id << 1 | true);
        }
      } else {
        o.add(l.id << 1 | false);
        o.add(l.id << 1 | true);
      }
    }
  }
  return o;
};
exports.adjustSelectionSnap = function (e, t, n) {
  let r = y(h(e).selectedPoints);
  let i = (0, u.getSimulatorCommittedTrack)(e);
  const o = !!(t & 1);
  let s = i.getLine(t >> 1);
  let l = o ? s.p2 : s.p1;
  let c = new a.default(l).add(n);
  const f = {
    type: s.type,
    isRightSide: s.flipped ? !o : o
  };
  const p = (0, d.getPointSnapPos)(c, e, f, r, null, false);
  return new a.default(p).sub(l);
};
exports.adjustSelection = g;
var i;
var o = require("./16.js");
var a = (i = o) && i.__esModule ? i : {
  default: i
};
var s = require("./205.js");
var l = require("./27.js");
var u = require("./8.js");
var c = require("./7.js");
var d = require("./67.js");
exports.Status = {
  inactive: () => ({
    inactive: true
  }),
  hovered: ({
    points: e,
    pointId: t = null,
    lineId: n = null
  }) => ({
    hovered: {
      points: e,
      pointId: t,
      lineId: n
    }
  }),
  pressed: ({
    startPos: e,
    pointId: t = null,
    lineId: n = null,
    changed: r = false,
    pendingDelta: i = null
  }) => ({
    pressed: {
      startPos: e,
      pointId: t,
      lineId: n,
      changed: r,
      pendingDelta: i,
      startTime: Date.now()
    }
  }),
  box: ({
    startPos: e,
    endPos: t
  }) => ({
    box: {
      startPos: e,
      endPos: t,
      startTime: Date.now()
    }
  })
};
const f = exports.LINE_WIDTH = 2;
const p = exports.POINT_RADIUS = 10;
exports.LINE_ADJUST_THRESHOLD = 250;
exports.setSelectToolState = e => (0, c.setToolState)(l.SELECT_TOOL, e);
const h = exports.getSelectToolState = e => (0, u.getToolState)(e, l.SELECT_TOOL);
exports.hasSelection = e => (0, u.getToolState)(e, l.SELECT_TOOL).selectedPoints.size > 0;
exports.hasClipboard = e => (0, u.getToolState)(e, l.SELECT_TOOL).clipboard.length > 0;
function m(e) {
  return new Set([...e, ...[...e].map(e => e ^ 1)]);
}
function y(e) {
  return new Set([...e].map(e => e >> 1));
}
function g(e, t, n, r, i, o, s) {
  let l = h(e).selectedPoints;
  let c = (0, u.getSimulatorCommittedTrack)(e);
  let f = r;
  let p = new Map();
  let v = false;
  if (t) {
    if (o) {
      let e = c.getLine(t >> 1);
      let n = new a.default(e.p2).sub(e.p1).norm();
      f = n.mul(n.dot(f));
    } else if (i) {
      const n = !!(t & 1);
      let r = c.getLine(t >> 1);
      let i = n ? r.p2 : r.p1;
      let o = n ? r.p1 : r.p2;
      let s = new a.default(i).add(f);
      let u = y(l);
      const p = {
        type: r.type,
        isRightSide: r.flipped ? !n : n
      };
      let h = (0, d.getPointSnapPos)(s, e, p, u, o, false);
      if (h.x !== s.x || h.y !== s.y) {
        v = true;
        f = new a.default(h).sub(i);
      }
    }
  }
  if (n && (l = m(l), o)) {
    let e = c.getLine(n);
    let t = new a.default(e.p2).sub(e.p1).norm();
    if (s) {
      t = t.rotCW(Math.PI / 2);
    }
    f = t.mul(t.dot(f));
  }
  for (let a of l) {
    let e = a >> 1;
    let t = a & 1;
    let n = p.get(e);
    if (!n) {
      if (!(n = c.getLine(e))) {
        continue;
      }
      n = n.toJSON();
      p.set(e, n);
    }
    if (t) {
      n.x2 += f.x;
      n.y2 += f.y;
    } else {
      n.x1 += f.x;
      n.y1 += f.y;
    }
  }
  let b = [...p.values()];
  if (v) {
    for (let a of b) {
      if (a.x1 === a.x2 && a.y1 === a.y2) {
        return g(e, t, n, r, false, false);
      }
    }
  }
  return b;
}