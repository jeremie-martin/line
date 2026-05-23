Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = s(require("./25.js"));
var i = s(require("./61.js"));
var o = s(require("./66.js"));
var a = s(require("./64.js"));
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const l = {
  Point1: new o.default(255, 255, 255, 255),
  Point2: new o.default(0, 0, 0, 255),
  Velocity: new o.default(0, 255, 0, 255),
  Velocity2: new o.default(0, 0, 0, 255),
  Stick: new o.default(64, 64, 255, 255),
  BindStick: new o.default(255, 64, 64, 255),
  RemountStick: new o.default(255, 64, 64, 255),
  RepelStick: new o.default(255, 64, 200, 255),
  HitTest: new o.default(0, 255, 0, 200)
};
const u = {
  Point1: new o.default(255, 255, 255, 255),
  Point2: new o.default(0, 0, 0, 255),
  Velocity: new o.default(0, 255, 0, 32),
  Velocity2: new o.default(0, 0, 0, 64),
  Stick: new o.default(0, 0, 0, 16),
  BindStick: new o.default(0, 0, 0, 16),
  RemountStick: new o.default(0, 0, 0, 16),
  RepelStick: new o.default(0, 0, 0, 16)
};
const d = new o.default(0, 0, 0, 0);
function f(e, t, n, r, o, a, s, l, u) {
  let c = {
    x: e,
    y: t,
    colorA: a,
    colorB: u ? d : a,
    thickness: o
  };
  let f = {
    x: n,
    y: r,
    colorA: a,
    colorB: u ? d : a,
    thickness: o
  };
  return new i.default(c, f, s, l);
}
const p = (Math.sqrt(5) - 1) / 2;
const h = (e, t) => t > 8 && (e + p * (t / 8 << 0)) % 1 < 0.04 ? 1 : 0;
const m = e => (e < 0 ? 2 : e < 40 ? 3 - Math.cos(Math.PI * e / 40) : 4) / 8;
function y(e, t) {
  return e === t || (e != null || t == null) && (e == null || t != null) && e.x === t.x && e.y === t.y;
}
const g = new r.default.List();
const v = new r.default.List();
exports.default = class {
  constructor(e) {
    this.index = e;
    this.backgroundEntities = new r.default.List();
    this.onionSkinEntities = new r.default.List();
    this.foregroundEntities = new r.default.List();
    this.skeletons = new r.default.List();
    this.prevStartFlagPos = null;
    this.prevFlagPos = null;
    this.flagEntity = null;
    this.prevSeed = null;
    this.riderEntity = null;
  }
  updateBackgroundEntities(e, t, n, r) {
    if (!n) {
      this.backgroundEntities = g;
      return;
    }
    const i = this.getFlagEntity(e, t, r);
    if (this.backgroundEntities.size() === 0) {
      this.backgroundEntities = this.backgroundEntities.push(i);
    } else if (this.backgroundEntities.get(0) !== i) {
      this.backgroundEntities = this.backgroundEntities.set(0, i);
    }
  }
  generateOnionSkinFromScratch(e, t, n, i) {
    let o = [];
    for (let r = n; r <= i; ++r) {
      const n = this.makeRider(e, t, r, 0.1);
      o.push(n);
    }
    this.onionSkinEntities = new r.default.List(o);
  }
  updateOnionSkinEntities(e, t, n, i, o, a) {
    if (!i) {
      this.onionSkinEntities = v;
      return;
    }
    for (let r = 0; r < this.onionSkinEntities.size() && this.onionSkinEntities.get(r).index < o; ++r) {
      this.onionSkinEntities = this.onionSkinEntities.splice(r, 1);
      r -= 1;
    }
    for (let r = 0; r < this.onionSkinEntities.size(); ++r) {
      const t = this.onionSkinEntities.get(r);
      if (t.rawRider !== e.getRawRiders(t.index)[this.index] || t.index > a) {
        this.onionSkinEntities = this.onionSkinEntities.splice(r, this.onionSkinEntities.size() - r);
        break;
      }
    }
    if (this.onionSkinEntities.size() === 0) {
      this.generateOnionSkinFromScratch(e, t, o, a);
      return;
    }
    let s = [];
    let l = this.onionSkinEntities.get(0).index;
    for (let r = o; r < l; ++r) {
      s.push(this.makeRider(e, t, r, 0.1));
    }
    if (s.length > 0) {
      this.onionSkinEntities = r.default.List.prototype.splice.apply(this.onionSkinEntities, [0, 0, ...s]);
    }
    let u = [];
    for (let r = this.onionSkinEntities.get(this.onionSkinEntities.size() - 1).index + 1; r <= a; ++r) {
      u.push(this.makeRider(e, t, r, 0.1));
    }
    if (u.length > 0) {
      this.onionSkinEntities = r.default.List.prototype.splice.apply(this.onionSkinEntities, [this.onionSkinEntities.size(), 0, ...u]);
    }
  }
  updateForegroundEntities(e, t, n) {
    const i = this.getRiderEntity(e, t, n);
    this.foregroundEntities = new r.default.List([i]);
  }
  generateSkeletonsFromScratch(e, t, n, i) {
    let o = [];
    for (let r = t; r <= n; ++r) {
      const t = this.makeSkeleton(e, r);
      o.push(t);
    }
    this.skeletons = new r.default.List(o);
  }
  updateSkeletons(e, t, n, i, o) {
    if (!n) {
      this.skeletons = v;
      return;
    }
    for (let r = 0; r < this.skeletons.size() && this.skeletons.get(r).index < i; ++r) {
      this.skeletons = this.skeletons.splice(r, 1);
      r -= 1;
    }
    for (let r = 0; r < this.skeletons.size(); ++r) {
      const t = this.skeletons.get(r);
      if (t.rawRider !== e.getRawRiders(t.index)[this.index] || t.index > o) {
        this.skeletons = this.skeletons.splice(r, this.skeletons.size() - r);
        break;
      }
    }
    if (this.skeletons.size() === 0) {
      this.generateSkeletonsFromScratch(e, i, o, t);
      return;
    }
    let a = [];
    let s = this.skeletons.get(0).index;
    for (let r = i; r < s; ++r) {
      a.push(this.makeSkeleton(e, r));
    }
    if (a.length > 0) {
      this.skeletons = r.default.List.prototype.splice.apply(this.skeletons, [0, 0, ...a]);
    }
    let l = [];
    for (let r = this.skeletons.get(this.skeletons.size() - 1).index + 1; r <= o; ++r) {
      l.push(this.makeSkeleton(e, r));
    }
    if (l.length > 0) {
      this.skeletons = r.default.List.prototype.splice.apply(this.skeletons, [this.skeletons.size(), 0, ...l]);
    }
  }
  updateSkeleton(e, t) {
    this.skeleton = this.makeSkeleton(e, t, true);
  }
  updateLineHitTest(e, t) {
    if (this.index === 0) {
      this.lineHitTest = [];
      const r = e.engine.getFrame(t);
      for (let t of r.involvedLineIds) {
        const r = e.getLine(t);
        let i = r.x1;
        let o = r.y1;
        let a = r.x2;
        let s = r.y2;
        if (!r.flipped) {
          var n = [a, s, i, o];
          i = n[0];
          o = n[1];
          a = n[2];
          s = n[3];
        }
        const u = l.HitTest;
        this.lineHitTest.push(f(i, o, a, s, 2, u, 0, t, true));
      }
    }
  }
  getEntities(e, t = this.startPosition, n, r, i, o, a, s) {
    this.updateBackgroundEntities(e, t, r, i);
    this.updateOnionSkinEntities(e, t, n, o, a, s);
    this.updateForegroundEntities(e, t, n);
    this.updateSkeleton(e, n);
    this.updateSkeletons(e, n, o, a, s);
    this.updateLineHitTest(e, n);
    return {
      background: this.backgroundEntities,
      onionSkin: this.onionSkinEntities,
      foreground: this.foregroundEntities,
      skeleton: this.skeleton,
      skeletons: this.skeletons,
      lineHitTest: this.lineHitTest
    };
  }
  getFlagEntity(e, t, n) {
    const r = e => e.name === "TAIL" || e.name === "LTIREB";
    let i = e.getRawRiders(0)[this.index].points.find(r).pos;
    let o = e.getRawRiders(n)[this.index].points.find(r).pos;
    if (!this.flagEntity || !y(this.prevStartFlagPos, i) || !y(this.prevFlagPos, o)) {
      this.prevStartFlagPos = i;
      this.prevFlagPos = o;
      this.flagEntity = {
        type: "flag",
        points: {
          START_FLAG: i,
          FLAG: o
        },
        zIndex: -1,
        alpha: 1
      };
    }
    return this.flagEntity;
  }
  getRiderEntity(e, t, n) {
    let r = this.index * Math.PI;
    let i = e.getRawRiders(n)[this.index];
    if (this.prevSeed !== r || !this.riderEntity || this.riderEntity.rawRider !== i) {
      this.riderEntity = this.makeRider(e, t, n, 1);
      this.riderEntity.zIndex = 1000000000;
    }
    return this.riderEntity;
  }
  makeRider(e, t, n, r) {
    let i = this.index * Math.PI;
    let o = e.getRawRiders(n)[this.index];
    let a = {};
    for (let l of o.points) {
      a[l.name] = l.pos;
    }
    let s = n % 1;
    return {
      type: "rider",
      points: a,
      params: {
        rotation: m(o.framesSinceUnmount),
        blinking: (1 - s) * h(i, n) + s * h(i, n + 1),
        broken: Math.max(0, Math.min(1, o.framesSinceSledBreak)),
        crashed: Math.max(0, Math.min(1, o.framesSinceStringDetached))
      },
      rawRider: o,
      zIndex: n,
      index: n,
      alpha: r
    };
  }
  makeSkeleton(e, t, n) {
    const r = n ? l : u;
    let i = e.getRawRiders(t)[this.index];
    let o = [];
    let s = [];
    let d = {};
    let p = t * (i.constraints.length + i.points.length * 4) + this.index * 1000000000;
    for (let a of i.points) {
      d[a.name] = a.pos;
    }
    for (let a of i.constraints) {
      if (a.type in r) {
        if ((a.type === "BindStick" || a.type === "RemountStick") && i.framesSinceStringDetached === 1) {
          continue;
        }
        const e = r[a.type];
        let t = d[a.p1];
        let n = d[a.p2];
        s.push(f(t.x, t.y, n.x, n.y, 0.1, e, 1, p++));
      }
    }
    for (let l of i.points) {
      if (l.type === "CollisionPoint") {
        const e = new a.default(l.vel).norm();
        o.push(f(l.pos.x, l.pos.y, l.pos.x + e.x, l.pos.y + e.y, 0.15, r.Velocity, 2, p++));
        o.push(f(l.pos.x, l.pos.y, l.pos.x + e.x, l.pos.y + e.y, 0.03, r.Velocity2, 2, p++));
        o.push(f(l.pos.x, l.pos.y, l.pos.x + 0.000001, l.pos.y, 0.25, r.Point2, 2, p++));
        o.push(f(l.pos.x, l.pos.y, l.pos.x + 0.000001, l.pos.y, 0.15, r.Point1, 2, p++));
      }
    }
    const h = [...s, ...o];
    h.index = t;
    h.rawRider = i;
    return h;
  }
};
module.exports = exports.default;