Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CANCEL_THRESHOLD = undefined;
exports.getZoom = function (e, t) {
  let n = Math.pow(s.STRENGTH, t);
  return Math.min(Math.max(e / n, s.MIN), s.MAX);
};
exports.getPosFromZoom = function (e, t, n, r) {
  return new o.default(t).sub(e).div(n / r).add(e);
};
exports.getMinLineLength = function (e, t = 0.1) {
  return Math.max(4 / (0, a.getEditorZoom)(e), t);
};
exports.getPointSnapPos = function (e, t, {
  type: n,
  isRightSide: r
}, i, u, c) {
  let d = (0, a.getEditorZoom)(t);
  let f = (0, a.getSimulatorCommittedTrack)(t);
  let p = l / Math.min(d, s.MAX / 10);
  let h = e;
  let m = null;
  let y = f.selectLinesInRadius(e, p);
  function g(t, n) {
    if (u && t.x === u.x && t.y === u.y) {
      return;
    }
    let r = e.dist(t);
    if (r < p) {
      p = r;
      h = t;
      m = n;
    }
  }
  switch (n) {
    case 0:
    case 1:
      {
        const e = [];
        const t = [];
        for (let n of y) {
          if (!i || !i.has(n.id)) {
            switch (n.type) {
              case 0:
              case 1:
                e.push({
                  point: n.p1,
                  otherPoint: n.p2,
                  isRightSide: n.flipped
                });
                e.push({
                  point: n.p2,
                  otherPoint: n.p1,
                  isRightSide: !n.flipped
                });
                break;
              default:
                t.push({
                  point: n.p1,
                  otherPoint: n.p2
                });
                t.push({
                  point: n.p2,
                  otherPoint: n.p1
                });
            }
          }
        }
        e.sort((e, t) => e.point.x === t.point.x ? t.point.y - e.point.y : t.point.x - e.point.x);
        if (e.length > 0) {
          let n = e.shift();
          let i = !n.isRightSide;
          let o = n.isRightSide;
          for (let a of e) {
            if (a.point.equals(n.point)) {
              i = i || !a.isRightSide;
              o = o || a.isRightSide;
            } else {
              if ((!i || !o) && n.isRightSide !== r) {
                t.push(n);
              }
              i = !(n = a).isRightSide;
              o = n.isRightSide;
            }
          }
          if ((!i || !o) && n.isRightSide !== r) {
            t.push(n);
          }
        }
        for (let n of t) {
          g(n.point, n.otherPoint);
        }
        break;
      }
    default:
      for (let e of y) {
        if (!i || !i.has(e.id)) {
          g(e.p1, e.p2);
          g(e.p2, e.p1);
        }
      }
  }
  if (m && c) {
    h = {
      x: h.x,
      y: h.y,
      vec: new o.default(h).sub(m).norm()
    };
  }
  return h;
};
exports.getAngleSnapPos = function (e, t) {
  let n;
  let r = new o.default(e).sub(t);
  let i = Math.atan2(r.y, r.x) / Math.PI * 180;
  if ((i = Math.round(i / c) * c) in u) {
    n = u[i];
  } else {
    let e = i / 180 * Math.PI;
    n = {
      x: Math.cos(e),
      y: Math.sin(e)
    };
  }
  return new o.default(n).mul(r.dot(n)).add(t);
};
exports.getAngleLockPos = function (e, t, n) {
  let r = new o.default(e).sub(t);
  return new o.default(n).mul(r.dot(n)).add(t);
};
var r;
var i = require("./16.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
var a = require("./8.js");
const s = {
  STRENGTH: Math.pow(2, 1 / 64),
  MIN: 1 / 32,
  MAX: 32
};
window.$Zoom = s;
exports.CANCEL_THRESHOLD = 300;
const l = 6;
const u = {
  360: {
    x: 1,
    y: 0
  },
  0: {
    x: 1,
    y: 0
  },
  45: {
    x: Math.SQRT1_2,
    y: Math.SQRT1_2
  },
  90: {
    x: 0,
    y: 1
  },
  135: {
    x: -Math.SQRT1_2,
    y: Math.SQRT1_2
  },
  180: {
    x: -1,
    y: 0
  },
  225: {
    x: -Math.SQRT1_2,
    y: -Math.SQRT1_2
  },
  270: {
    x: 0,
    y: -1
  },
  315: {
    x: Math.SQRT1_2,
    y: -Math.SQRT1_2
  }
};
const c = 15;