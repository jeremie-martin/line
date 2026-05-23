Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.classicCells = function (e, t) {
  return a.getCellsPos(e, t).map(e => new o.default(e));
};
exports.legacyCells = function (e, t) {
  return s.getCellsPos(e, t).map(e => new o.default(e));
};
var r;
var i = require("./16.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
class a {
  static getCellsPos(e, t) {
    var n = [];
    let r = l(e.p1.x, e.p1.y, t);
    let i = l(e.p2.x, e.p2.y, t);
    n.push(r);
    if (e.vec.x === 0 && e.vec.y === 0 || r.x === i.x && r.y === i.y) {
      return n;
    }
    let o;
    let a = function (e, t, n, r) {
      let i = Math.min(e, n);
      let o = Math.max(e, n);
      let a = Math.min(t, r);
      let s = Math.max(t, r);
      return {
        left: i,
        right: o,
        top: a,
        bottom: s,
        corners: [[i, a], [i, s], [o, a], [o, s]].map(e => ({
          x: e[0],
          y: e[1]
        }))
      };
    }(r.x, r.y, i.x, i.y);
    o = e.vec.x === 0 ? (e, t, n, r, i) => ({
      x: t,
      y: n + i
    }) : e.vec.y === 0 ? (e, t, n, r, i) => ({
      x: t + r,
      y: n
    }) : this.getNextPos;
    let s = r;
    let u = {
      x: e.p1.x,
      y: e.p1.y
    };
    while (s != null) {
      let r = this.getDelta(e, s, t);
      let i = o(e, u.x, u.y, r.x, r.y);
      let d = l(i.x, i.y, t);
      if (d.x === s.x && d.y === s.y) {
        break;
      }
      if (c(d, a)) {
        n.push(d);
        s = d;
        u = i;
      } else {
        s = null;
      }
    }
    return n;
  }
  static getNextPos(e, t, n, r, i) {
    let o = n + e.vec.y / e.vec.x * r;
    if (Math.abs(o - n) < Math.abs(i)) {
      return {
        x: t + r,
        y: o
      };
    } else if (Math.abs(o - n) === Math.abs(i)) {
      return {
        x: t + r,
        y: n + i
      };
    } else {
      return {
        x: t + e.vec.x * i / e.vec.y,
        y: n + i
      };
    }
  }
  static getDelta(e, t, n) {
    let r;
    let i;
    return {
      x: r = t.x < 0 ? (n + t.gx) * (e.vec.x > 0 ? 1 : -1) : -t.gx + (e.vec.x > 0 ? n : -1),
      y: i = t.y < 0 ? (n + t.gy) * (e.vec.y > 0 ? 1 : -1) : -t.gy + (e.vec.y > 0 ? n : -1)
    };
  }
}
class s extends a {
  static getDelta(e, t, n) {
    return {
      x: -t.gx + (e.vec.x > 0 ? n : -1),
      y: -t.gy + (e.vec.y > 0 ? n : -1)
    };
  }
  static getNextPos(e, t, n, r, i) {
    let o = e.vec.y / e.vec.x;
    let a = e.p1.y - o * e.p1.x;
    let s = Math.round(o * (t + r) + a);
    if (Math.abs(s - n) < Math.abs(i)) {
      return {
        x: t + r,
        y: s
      };
    } else if (Math.abs(s - n) === Math.abs(i)) {
      return {
        x: t + r,
        y: n + i
      };
    } else {
      return {
        x: Math.round((n + i - a) / o),
        y: n + i
      };
    }
  }
}
function l(e, t, n) {
  var r = function (e, t, n) {
    return {
      x: u(e, n),
      y: u(t, n)
    };
  }(e, t, n);
  let i = r.x;
  let o = r.y;
  return {
    x: i,
    y: o,
    gx: e - n * i,
    gy: t - n * o
  };
}
function u(e, t) {
  return Math.floor(e / t);
}
function c(e, t) {
  return e.x >= t.left && e.x <= t.right && e.y >= t.top && e.y <= t.bottom;
}