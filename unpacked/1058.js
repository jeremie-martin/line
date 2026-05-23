Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getSceneLayer = function (e) {
  let t = (0, d.getModifier)(e, "modifiers.select.singlePoint");
  let n = (0, c.getSimulatorTrack)(e);
  let i = (0, c.getEditorZoom)(e);
  let a = [];
  let s = [];
  let f = [];
  var _ = (0, u.getSelectToolState)(e);
  let w = _.selectedPoints;
  let x = _.status;
  let E = _.multi;
  let S = x.pressed && x.pressed.pendingDelta;
  S ||= {
    x: 0,
    y: 0
  };
  const T = !E && !x.box;
  let k = u.LINE_WIDTH / 4;
  let O = u.LINE_WIDTH / 3;
  if (T || w.size < v) {
    for (let r of w) {
      let e = n.getLine(r >> 1);
      if (!e) {
        continue;
      }
      let t = r & 1 ? e.p2 : e.p1;
      s.push(...g(t.x + S.x, t.y + S.y, u.POINT_RADIUS / i / 4, 1 / i, p.Selected, p.PointBorder, 3000000000 + r));
    }
  }
  let P = (0, u.getLinesFromPoints)(w);
  if (T || P.size < b) {
    for (let r of P) {
      let e = n.getLine(r);
      if (e) {
        a.push(m(e.p1.x + S.x, e.p1.y + S.y, e.p2.x + S.x, e.p2.y + S.y, k, p.Selected, 0 + r));
      }
    }
  }
  if (E && w.size > 0) {
    var C = (0, u.getBoundingBox)(n, P);
    let e = C.x;
    let t = C.y;
    let r = C.width;
    let o = C.height;
    e += S.x;
    t += S.y;
    f.push(...y(e, t, e + r, t + o, 1 / i, p.BoundingBox, 6000000000));
  }
  if (x.hovered || x.box || x.pressed) {
    let r;
    let o;
    if (x.hovered) {
      r = x.hovered.points;
    }
    if (x.box) {
      var I = x.box;
      let a = I.startPos;
      let s = I.endPos;
      r = (0, u.selectPointsFromBox)(e, a, s, t);
      o = (0, u.getLinesFromPoints)(r);
      var M = (0, u.getBoundingBox)(n, o);
      let l = M.x;
      let c = M.y;
      let d = M.width;
      let m = M.height;
      l += S.x;
      c += S.y;
      f.push(...y(l, c, l + d, c + m, 1 / i, p.ActiveBoundingBox, 6000000001));
    }
    if (x.pressed) {
      r = w;
    }
    if (T || r.size < v) {
      for (let t of r) {
        let r;
        let o = n.getLine(t >> 1);
        if (o) {
          r = t & 1 ? o.p2 : o.p1;
          s.push(...g(r.x + S.x, r.y + S.y, u.POINT_RADIUS / i / 2, 1 / i, (0, d.getModifier)(e, "modifiers.select.lifelock") ? p.ActiveLifelock : p.Active, p.PointBorder, 4000000000 + t));
        }
      }
    }
    o = o || (0, u.getLinesFromPoints)(r);
    if (T || o.size < b) {
      for (let e of o) {
        let t = n.getLine(e);
        if (t) {
          a.push(m(t.p1.x + S.x, t.p1.y + S.y, t.p2.x + S.x, t.p2.y + S.y, O, p.Active, 1000000000 + e));
        }
      }
    }
  }
  if (x.pressed || x.hovered) {
    var L = x.pressed || x.hovered;
    let t = L.pointId;
    let r = L.lineId;
    if (t) {
      let r = n.getLine(t >> 1);
      if (r) {
        let n = t & 1 ? r.p2 : r.p1;
        s.push(...g(n.x + S.x, n.y + S.y, u.POINT_RADIUS / i / 2, 1 / i, (0, d.getModifier)(e, "modifiers.select.lifelock") ? p.ActiveLifelock : p.Focused, p.PointBorder, 5000000000 + t));
      }
    }
    if (r) {
      let e = n.getLine(r);
      if (e) {
        a.push(m(e.p1.x + S.x, e.p1.y + S.y, e.p2.x + S.x, e.p2.y + S.y, O, p.Focused, 2000000000 + r));
      }
    }
  }
  if (x.box) {
    var R = x.box;
    let e = R.startPos;
    let t = R.endPos;
    f.push(...y(Math.min(e.x, t.x), Math.min(e.y, t.y), Math.max(e.x, t.x), Math.max(e.y, t.y), 1 / i, p.SelectionBox, 7000000000));
  }
  let A = new o.default(l.TOOL_LAYER);
  A.entities = new r.default.List([...a, ...s, ...f]);
  return A;
};
var r = f(require("./25.js"));
var i = f(require("./66.js"));
var o = f(require("./107.js"));
var a = f(require("./61.js"));
var s = f(require("./167.js"));
var l = require("./127.js");
var u = require("./260.js");
var c = require("./8.js");
var d = require("./35.js");
function f(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const p = {
  Selected: new i.default(0, 230, 255, 255),
  Active: new i.default(0, 240, 150, 255),
  ActiveLifelock: new i.default(240, 0, 0, 255),
  Focused: new i.default(255, 255, 0, 255),
  BoundingBox: new i.default(64, 128, 255, 255),
  ActiveBoundingBox: new i.default(255, 64, 255, 255),
  SelectionBox: new i.default(128, 128, 128, 255),
  PointBorder: new i.default(0, 0, 0, 255)
};
function m(e, t, n, r, i, o, s) {
  let u = {
    x: e,
    y: t,
    colorA: o,
    colorB: o,
    thickness: i
  };
  let c = {
    x: n,
    y: r,
    colorA: o,
    colorB: o,
    thickness: i
  };
  return new a.default(u, c, l.TOOL_LAYER, s);
}
function y(e, t, n, r, i, o, a) {
  return [m(e, t, e, r, i, o, a), m(e, r, n, r, i, o, a + 0.1), m(n, r, n, t, i, o, a + 0.2), m(n, t, e, t, i, o, a + 0.3)];
}
function g(e, t, n, r, i, o, a) {
  return [function (e, t, n, r, i, o) {
    let a = {
      x: e,
      y: t,
      color: i
    };
    let u = {
      x: e,
      y: r,
      color: i
    };
    let c = {
      x: n,
      y: r,
      color: i
    };
    let d = {
      x: n,
      y: t,
      color: i
    };
    return new s.default(a, u, c, d, l.TOOL_LAYER, o);
  }(e - n, t - n, e + n, t + n, i, a), ...y(e - n, t - n, e + n, t + n, r, o, a + 0.5)];
}
const v = 1000;
const b = 5000;