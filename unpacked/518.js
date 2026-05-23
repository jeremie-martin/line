Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = P(require("./16.js"));
var i = P(require("./519.js"));
var o = P(require("./292.js"));
var a = P(require("./523.js"));
var s = P(require("./524.js"));
var l = P(require("./525.js"));
var u = P(require("./526.js"));
var c = P(require("./65.js"));
var d = P(require("./527.js"));
var f = P(require("./528.js"));
var p = P(require("./529.js"));
var h = P(require("./530.js"));
var m = P(require("./531.js"));
var y = P(require("./532.js"));
var g = P(require("./295.js"));
var v = P(require("./533.js"));
var b = P(require("./202.js"));
var _ = require("./204.js");
var w = require("./205.js");
var x = P(require("./104.js"));
var E = P(require("./105.js"));
var S = P(require("./534.js"));
var T = P(require("./535.js"));
var k = P(require("./536.js"));
var O = P(require("./537.js"));
function P(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const C = {
  gravity: _.GRAVITY
};
window.$ENGINE_PARAMS = C;
exports.default = class {
  constructor(e, t) {
    this.collidingGrid = e ? new o.default() : new i.default();
    this.nonCollidingGrid = new a.default();
    this.riders = t;
    this.physicsEngine = new s.default();
    this.lineCounts = {
      total: 0
    };
    this.visibleLayers = new Set([0]);
    this.editableLayers = new Set([0]);
    this.physicsEngine.registerPointType("CollisionPoint", l.default);
    this.physicsEngine.registerPointType("FlutterPoint", u.default);
    this.physicsEngine.registerConstraintType("Stick", c.default);
    this.physicsEngine.registerConstraintType("BindStick", d.default);
    this.physicsEngine.registerConstraintType("RepelStick", f.default);
    this.physicsEngine.registerConstraintType("BindJoint", p.default);
    this.physicsEngine.registerConstraintType("DirectedChain", h.default);
    this.physicsEngine.registerConstraintType("RemountStick", T.default);
    this.physicsEngine.registerConstraintType("RemountJoint", k.default);
    this.physicsEngine.registerConstraintType("RemountJoint2", O.default);
    this.physicsEngine.registerEntityType("Rider", m.default);
    this.physicsEngine.registerEntityType("RemountRider", E.default);
    this.physicsEngine.registerEntityType("RemountRider2", S.default);
    this.physicsEngine.registerEntityType("EntityBase", x.default);
    this._frames = [this._getInitialFrame()];
  }
  addLine(e) {
    if (e.collidable) {
      this._invalidateFrames(e);
      this.collidingGrid.addLine(e);
    } else {
      this.nonCollidingGrid.addLine(e);
    }
    if (this.lineCounts[e.type] == null) {
      this.lineCounts[e.type] = 0;
    }
    this.lineCounts[e.type]++;
    this.lineCounts.total++;
  }
  removeLine(e) {
    if (e.collidable) {
      this._invalidateFrames(e);
      this.collidingGrid.removeLine(e);
    } else {
      this.nonCollidingGrid.removeLine(e);
    }
    this.lineCounts[e.type]--;
    this.lineCounts.total--;
  }
  setLayerVisible(e, t) {
    if (t) {
      this.visibleLayers.add(e);
    } else {
      this.visibleLayers.delete(e);
    }
  }
  setLayerEditable(e, t) {
    if (t) {
      this.editableLayers.add(e);
    } else {
      this.editableLayers.delete(e);
    }
  }
  getLineCounts() {
    return this.lineCounts;
  }
  getGridSize() {
    return this.collidingGrid.gridSize;
  }
  setRiders(e = []) {
    let t = false;
    if (this.riders.length !== e.length) {
      t = true;
    }
    for (let n = 0; n < Math.min(this.riders.length, e.length); n++) {
      let i = this.riders[n];
      let o = e[n];
      if (!r.default.equals(i.startPosition, o.startPosition) || !r.default.equals(i.startVelocity, o.startVelocity) || i.startAngle !== o.startAngle || i.remountable !== o.remountable) {
        t = true;
      }
    }
    if (t) {
      this.riders = e;
      this._frames = [this._getInitialFrame()];
    }
  }
  getFrame(e) {
    if (e >= this._frames.length) {
      for (this.physicsEngine.setCurrentFrame(this._frames[this._frames.length - 1]); this._frames.length <= e;) {
        this._frames.push(this.physicsEngine.getNextFrame(this.collidingGrid, C));
      }
    }
    return this._frames[e];
  }
  selectLinesInRadius(e, t) {
    return this._selectLinesInRadius(this.collidingGrid, e, t).concat(this._selectLinesInRadius(this.nonCollidingGrid, e, t));
  }
  _selectLinesInRadius(e, t, n) {
    const r = n * n;
    return e.getLinesApproximatelyInRect(t.x - n, t.y - n, t.x + n, t.y + n, e => this.lineSelectable(e) && (0, w.pointLineDistanceSquared)(t.x, t.y, e.p1.x, e.p1.y, e.p2.x, e.p2.y) <= r);
  }
  selectLinesInRect(e) {
    return this._selectLinesInRect(this.collidingGrid, e).concat(this._selectLinesInRect(this.nonCollidingGrid, e));
  }
  _selectLinesInRect(e, t) {
    return e.getLinesApproximatelyInRect(t.x, t.y, t.x + t.width, t.y + t.height, e => this.lineSelectable(e) && (0, w.lineInBox)(e.x1, e.y1, e.x2, e.y2, t.x, t.y, t.x + t.width, t.y + t.height));
  }
  lineSelectable(e) {
    return e.layer == null && this.visibleLayers.has(0) && this.editableLayers.has(0) || this.visibleLayers.has(e.layer) && this.editableLayers.has(e.layer);
  }
  _invalidateFrames(e) {
    let t = this.collidingGrid.getGridCellCoordsForLine(e);
    for (let n = 0; n < this._frames.length; ++n) {
      for (let e = 0; e < t.length; ++e) {
        const r = this._frames[n];
        const i = t[e];
        if (r.involvedGridCells.has(i)) {
          this._frames.splice(n);
          return;
        }
      }
    }
  }
  _getInitialFrame() {
    let e = {
      snapshot: {
        index: 0,
        entities: [{
          type: "EntityBase",
          entities: this.riders.map((e, t) => this._getInitialRider(e, t))
        }]
      },
      involvedGridCells: new b.default(),
      involvedLineIds: [],
      numPartialFrames: 0
    };
    this.physicsEngine.setCurrentFrame(e);
    e.snapshot = this.physicsEngine.getSnapshot();
    const t = e.snapshot.entities[0].entities;
    for (let i = 0; i < t.length; i++) {
      const e = t[i];
      var n = this.riders[i];
      const o = n.startPosition;
      const a = n.startVelocity;
      const s = n.startAngle;
      e.points.forEach(e => {
        if (s) {
          const t = new r.default(e.pos);
          t.rotateAbout({
            x: 0,
            y: 5
          }, s / 180 * Math.PI);
          e.pos.x = t.x;
          e.pos.y = t.y;
        }
        e.pos.x += o.x;
        e.pos.y += o.y;
        e.vel = {
          x: a.x,
          y: a.y
        };
        e.prevPos = {
          x: e.pos.x - e.vel.x,
          y: e.pos.y - e.vel.y
        };
      });
    }
    return e;
  }
  _getInitialRider(e, t) {
    if (e.remountable) {
      let n;
      switch (e.remountable) {
        case true:
          n = g.default;
          break;
        case 1:
          n = v.default;
          break;
        default:
          n = v.default;
      }
      const r = JSON.parse(JSON.stringify(n));
      r.sledId = t;
      return r;
    }
    return JSON.parse(JSON.stringify(y.default));
  }
};
module.exports = exports.default;