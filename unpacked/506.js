Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = d(require("./82.js"));
var i = d(require("./512.js"));
var o = d(require("./25.js"));
var a = d(require("./518.js"));
var s = require("./204.js");
var l = require("./105.js");
var u = d(require("./538.js"));
var c = require("./142.js");
function d(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const f = [{
  startPosition: s.DEFAULT_START_POSITION,
  startVelocity: s.DEFAULT_START_VELOCITY
}, {
  startPosition: {
    x: 0,
    y: 200
  },
  startVelocity: s.DEFAULT_START_VELOCITY
}, {
  startPosition: {
    x: 0,
    y: -200
  },
  startVelocity: s.DEFAULT_START_VELOCITY
}];
let p = null;
class h extends i.default {
  getInitialStateAndComputed() {
    const e = {
      lines: new o.default.List(),
      layers: new o.default.List().push(new c.Layer(0, "Base Layer")),
      activeLayerId: 0,
      riders: u.default ? f : [{
        startPosition: s.DEFAULT_START_POSITION,
        startVelocity: s.DEFAULT_START_VELOCITY,
        remountable: 1
      }]
    };
    return {
      state: e,
      computed: new a.default(!this.props.legacy, e.riders)
    };
  }
  equals(e) {
    return !!e && !!(e instanceof h) && (this === e || this.state.lines.equals(e.state.lines) && this.state.riders === e.state.riders);
  }
  deepEquals(e) {
    return !!e && !!(e instanceof h) && (this === e || this.state.lines.deepEquals(e.state.lines) && this.state.riders === e.state.riders);
  }
  updateComputed(e, t, n) {
    super.updateComputed(e, t, n);
    e.setRiders(n.riders);
    const i = t.lines.compareTo(n.lines);
    i.forEachPrimitive(t => {
      if (t instanceof o.default.ListPatches.Add) {
        e.addLine(t.value);
      } else {
        if (!(t instanceof o.default.ListPatches.Remove)) {
          throw new Error("unknown primitive operation");
        }
        try {
          e.removeLine(t.value);
        } catch (e) {
          if (e.message !== "expected the cell to exist") {
            throw e;
          }
          r.default.captureException(e, {
            extra: {
              diff: i,
              prevDiff: p
            }
          });
        }
      }
    });
    p = i;
    t.layers.compareTo(n.layers).forEachPrimitive(t => {
      if (t instanceof o.default.ListPatches.Add) {
        e.setLayerVisible(t.value.id, t.value.visible);
        e.setLayerEditable(t.value.id, t.value.editable);
      } else {
        e.setLayerVisible(t.value.id, false);
        e.setLayerEditable(t.value.id, false);
      }
    });
  }
  getFrame(e) {
    if (Number.isInteger(e)) {
      return this.useComputed(t => t.getFrame(e));
    }
    let t = Math.floor(e);
    let n = Math.ceil(e);
    let r = e - t;
    let i = null;
    let o = null;
    this.useComputed(e => {
      i = e.getFrame(t);
      o = e.getFrame(n);
    });
    if (i.snapshot.entities.length !== o.snapshot.entities.length) {
      return i;
    }
    let a = [];
    for (let s = 0; s < i.snapshot.entities.length; ++s) {
      a.push(y(i.snapshot.entities[s], o.snapshot.entities[s], r));
    }
    return {
      numPartialFrames: i.numPartialFrames,
      involvedGridCells: i.involvedGridCells,
      involvedLineIds: i.involvedLineIds,
      interpolated: true,
      snapshot: {
        index: e,
        entities: a
      }
    };
  }
  getLineCounts() {
    return this.useComputed(e => e.getLineCounts());
  }
  getGridSize() {
    return this.useComputed(e => e.getGridSize());
  }
  withRidersChanged(e) {
    if (u.default) {
      return this;
    } else {
      return this.withStateChanged({
        riders: e
      });
    }
  }
  withLineAdded(e) {
    return this.withLinesAdded([e]);
  }
  withLinesAdded(e) {
    let t = this.state.lines;
    for (let n of e) {
      const e = t.findInsertionIndexWithBinarySearch(n.id, e => e.id);
      let r = t.get(e - 1);
      t = r && r.id === n.id ? t.set(e - 1, n) : t.withValueAdded(e, n);
    }
    return this.withStateChanged({
      lines: t
    });
  }
  withLineRemoved(e) {
    return this.withLinesRemoved([e]);
  }
  withLinesRemoved(e) {
    let t = this.state.lines;
    for (let n of e) {
      const e = t.findIndexWithBinarySearch(n, e => e.id);
      if (e > -1) {
        t = t.withValueRemoved(e);
      }
    }
    if (t === this.state.lines) {
      return this;
    } else {
      return this.withStateChanged({
        lines: t
      });
    }
  }
  selectLinesInRadius(e, t) {
    return this.useComputed(n => n.selectLinesInRadius(e, t));
  }
  selectLinesInRect(e) {
    return this.useComputed(t => t.selectLinesInRect(e));
  }
  selectCollidingLinesInRect(e) {
    return this.useComputed(t => t._selectLinesInRect(t.collidingGrid, e));
  }
  getBoundingBox() {
    if (this.state.lines.size() == 0) {
      return {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      };
    }
    let e = Number.MAX_VALUE;
    let t = Number.MAX_VALUE;
    let n = -Number.MAX_VALUE;
    let r = -Number.MAX_VALUE;
    this.state.lines.forEach(i => {
      e = Math.min(e, i.x1, i.x2);
      t = Math.min(t, i.y1, i.y2);
      n = Math.max(n, i.x1, i.x2);
      r = Math.max(r, i.y1, i.y2);
    });
    return {
      x: e,
      y: t,
      width: n - e,
      height: r - t
    };
  }
  withLayers(e) {
    return this.withStateChanged({
      layers: new o.default.List(e.map(({
        id: e,
        name: t,
        visible: n,
        editable: r,
        type: i,
        size: o,
        folderId: a
      }) => i === undefined ? new c.Layer(e, t, n, r) : i === c.LayerTypes.LAYER ? new c.Layer(e, t, n, r, a) : new c.LayerFolder(e, t, n, r, o)))
    });
  }
  withLayerAdded(e = "") {
    let t = 0;
    for (let r of this.state.layers) {
      t = Math.max(t, r.id);
    }
    const n = new c.Layer(t + 1, e);
    return this.withStateChanged({
      layers: this.state.layers.push(n)
    });
  }
  withLayerRemoved(e) {
    const t = this.state.layers.findIndex(t => t.id === e);
    if (t < 0) {
      return this;
    }
    const n = this.getContainingFolder(t);
    if (n < 0) {
      return this.withStateChanged({
        layers: this.state.layers.withValueRemoved(t),
        lines: this.state.lines.filter(t => t.layer !== e)
      });
    }
    const r = this.state.layers.get(n);
    const i = new c.LayerFolder(r.id, r.name, r.visible, r.editable, r.size - 1);
    return this.withStateChanged({
      layers: this.state.layers.set(n, i).withValueRemoved(t),
      lines: this.state.lines.filter(t => t.layer !== e)
    });
  }
  withLayerMoved(e, t) {
    const n = this.state.layers.findIndex(t => t.id === e);
    if (n < 0 || t < 0 || t >= this.state.layers.size()) {
      return this;
    }
    const r = this.state.layers.get(n);
    const i = this.getContainingFolder(n);
    const o = this.getContainingFolder(t);
    const a = t > n;
    const s = this.getContainingFolder(t + 1);
    if (a && i === t) {
      const e = this.state.layers.get(i);
      const o = new c.LayerFolder(e.id, e.name, e.visible, e.editable, e.size - 1);
      const a = new c.Layer(r.id, r.name, r.visible, r.editable, -1);
      return this.withStateChanged({
        layers: this.state.layers.set(i, o).withValueRemoved(n).withValueAdded(t, a)
      });
    }
    if (a && i < 0 && o === -1 && s !== -1) {
      const e = this.state.layers.get(s);
      const i = new c.LayerFolder(e.id, e.name, e.visible, e.editable, e.size + 1);
      const o = new c.Layer(r.id, r.name, r.visible, r.editable, e.id);
      return this.withStateChanged({
        layers: this.state.layers.set(s, i).withValueRemoved(n).withValueAdded(t, o)
      });
    }
    if (a && i < 0 && o === t) {
      return this.withStateChanged({
        layers: this.state.layers.withValueRemoved(n).withValueAdded(t, r)
      });
    }
    if (i === o) {
      return this.withStateChanged({
        layers: this.state.layers.withValueRemoved(n).withValueAdded(t, r)
      });
    }
    if (i >= 0 && o < 0) {
      const e = this.state.layers.get(i);
      const o = new c.LayerFolder(e.id, e.name, e.visible, e.editable, e.size - 1);
      const a = new c.Layer(r.id, r.name, r.visible, r.editable, -1);
      return this.withStateChanged({
        layers: this.state.layers.set(i, o).withValueRemoved(n).withValueAdded(t, a)
      });
    }
    if (o >= 0 && i < 0) {
      const e = this.state.layers.get(o);
      const i = new c.LayerFolder(e.id, e.name, e.visible, e.editable, e.size + 1);
      const a = new c.Layer(r.id, r.name, r.visible, r.editable, e.id);
      return this.withStateChanged({
        layers: this.state.layers.set(o, i).withValueRemoved(n).withValueAdded(t, a)
      });
    }
    const l = this.state.layers.get(i);
    const u = new c.LayerFolder(l.id, l.name, l.visible, l.editable, l.size - 1);
    const d = this.state.layers.get(o);
    const f = new c.LayerFolder(d.id, d.name, d.visible, d.editable, d.size + 1);
    const p = new c.Layer(r.id, r.name, r.visible, r.editable, d.id);
    return this.withStateChanged({
      layers: this.state.layers.set(i, u).set(o, f).withValueRemoved(n).withValueAdded(t, p)
    });
  }
  withLayerCopied(e) {
    const t = this.state.layers.findIndex(t => t.id === e);
    const n = this.state.layers.get(t);
    let r = 0;
    for (let a of this.state.layers) {
      r = Math.max(r, a.id);
    }
    const i = new c.Layer(r + 1, (n.name.slice(7) || "New Layer") + " (copy)", n.visible, n.editable, n.folderId);
    if (n.folderId < 0) {
      return this.withStateChanged({
        layers: this.state.layers.withValueAdded(t, i)
      });
    }
    const o = this.state.layers.findIndex(e => e.id === n.folderId);
    return this.withStateChanged({
      layers: this.state.layers.withMutation(o, e => new c.LayerFolder(e.id, e.name, e.visible, e.editable, e.size + 1)).withValueAdded(t, i)
    });
  }
  withLayerRenamed(e, t) {
    const n = this.state.layers.findIndex(t => t.id === e);
    if (n < 0) {
      return this;
    } else {
      return this.withStateChanged({
        layers: this.state.layers.withMutation(n, n => new c.Layer(e, t, n.visible, n.editable, n.folderId))
      });
    }
  }
  withLayerActive(e) {
    return this.withStateChanged({
      activeLayerId: e
    });
  }
  withLayerVisibilityChanged(e, t) {
    const n = this.state.layers.findIndex(t => t.id === e);
    if (n < 0) {
      return this;
    } else {
      return this.withStateChanged({
        layers: this.state.layers.withMutation(n, n => new c.Layer(e, n.name, t, n.editable, n.folderId))
      });
    }
  }
  withLayerEditableChanged(e, t) {
    const n = this.state.layers.findIndex(t => t.id === e);
    if (n < 0) {
      return this;
    } else {
      return this.withStateChanged({
        layers: this.state.layers.withMutation(n, n => new c.Layer(e, n.name, n.visible, t, n.folderId))
      });
    }
  }
  withFolderAdded(e = "") {
    let t = 0;
    for (let r of this.state.layers) {
      t = Math.max(t, r.id);
    }
    const n = new c.LayerFolder(t + 1, e);
    return this.withStateChanged({
      layers: this.state.layers.push(n)
    });
  }
  withFolderRemoved(e) {
    const t = this.state.layers.findIndex(t => t.id === e);
    if (t < 0) {
      return this;
    }
    const n = this.state.layers.get(t).size;
    if (n === 0) {
      return this.withStateChanged({
        layers: this.state.layers.withValueRemoved(t)
      });
    }
    const r = this.state.layers.slice(t - n, t).map(e => e.id);
    return this.withStateChanged({
      layers: this.state.layers.splice(t - n, n + 1),
      lines: this.state.lines.filter(e => !r.contains(e.layer))
    });
  }
  withFolderMoved(e, t) {
    const n = this.state.layers.findIndex(t => t.id === e);
    if (n < 0 || t < 0 || t >= this.state.layers.size()) {
      return this;
    }
    const r = this.state.layers.get(n);
    const i = this.state.layers.slice(n - r.size, n + 1);
    const o = t - (t > n ? r.size : 0);
    const a = this.getContainingFolder(t);
    if (a > 0) {
      const e = this.state.layers.get(a);
      if (t > n && a === t) {
        return this.withStateChanged({
          layers: this.state.layers.splice(n - r.size, r.size + 1).splice(o, 0, ...i)
        });
      } else if (t < n && a - e.size === t) {
        return this.withStateChanged({
          layers: this.state.layers.splice(n - r.size, r.size + 1).splice(o, 0, ...i)
        });
      } else {
        return this;
      }
    }
    return this.withStateChanged({
      layers: this.state.layers.splice(n - r.size, r.size + 1).splice(o, 0, ...i)
    });
  }
  withFolderRenamed(e, t) {
    const n = this.state.layers.findIndex(t => t.id === e);
    if (n < 0) {
      return this;
    } else {
      return this.withStateChanged({
        layers: this.state.layers.withMutation(n, n => new c.LayerFolder(e, t, n.visible, n.editable, n.size))
      });
    }
  }
  withFolderVisibilityChanged(e, t) {
    const n = this.state.layers.findIndex(t => t.id === e);
    if (n < 0) {
      return this;
    }
    const r = this.state.layers.get(n).size;
    if (r === 0) {
      return this.withStateChanged({
        layers: this.state.layers.withMutation(n, n => new c.LayerFolder(e, n.name, t, n.editable, n.size))
      });
    } else {
      return this.withStateChanged({
        layers: this.state.layers.withMutation(n, n => new c.LayerFolder(e, n.name, t, n.editable, n.size)).map((e, i) => n - r <= i && i < n ? new c.Layer(e.id, e.name, t, e.editable, e.folderId) : e)
      });
    }
  }
  withFolderEditableChanged(e, t) {
    const n = this.state.layers.findIndex(t => t.id === e);
    if (n < 0) {
      return this;
    }
    const r = this.state.layers.get(n).size;
    if (r === 0) {
      return this.withStateChanged({
        layers: this.state.layers.withMutation(n, n => new c.LayerFolder(e, n.name, n.visible, t, n.size))
      });
    } else {
      return this.withStateChanged({
        layers: this.state.layers.withMutation(n, n => new c.LayerFolder(e, n.name, n.visible, t, n.size)).map((e, i) => n - r <= i && i < n ? new c.Layer(e.id, e.name, e.visible, t, e.folderId) : e)
      });
    }
  }
  getContainingFolder(e) {
    const t = this.state.layers.findIndex((t, n) => t.type === c.LayerTypes.FOLDER && n >= e);
    if (t < 0) {
      return -1;
    } else if (t - this.state.layers.get(t).size <= e && e <= t) {
      return t;
    } else {
      return -1;
    }
  }
}
function m(e, t, n) {
  return e + (t - e) * n;
}
function y(e, t, n, r = null) {
  if (e.entities.length !== t.entities.length || e.type !== t.type || e.constraints.length !== t.constraints.length || e.points.length !== t.points.length) {
    return e;
  }
  let i;
  let o = [];
  let a = [];
  let s = [];
  for (let l = 0; l < e.constraints.length; ++l) {
    const r = e.constraints[l];
    const i = t.constraints[l];
    if (r.type !== i.type || r.name !== i.name || r.p1 !== i.p1 || r.p2 !== i.p2) {
      return e;
    }
    o.push({
      type: r.type,
      name: r.name,
      p1: r.p1,
      p2: r.p2,
      length: m(r.length, i.length, n)
    });
  }
  if (!!r && (e.type === "RemountRider" || e.type === "RemountRider2") && e.sledId !== t.sledId) {
    i = r.entities.find(t => t.sledId === e.sledId);
  }
  for (let u = 0; u < e.points.length; ++u) {
    const r = e.points[u];
    let o = t.points[u];
    if (i && l.SLED_POINT_INDICES.includes(u)) {
      o = i.points[u];
    }
    if (r.type !== o.type || r.name !== o.name) {
      return e;
    }
    a.push({
      type: r.type,
      name: r.name,
      airFriction: r.airFriction,
      friction: r.friction,
      pos: {
        x: m(r.pos.x, o.pos.x, n),
        y: m(r.pos.y, o.pos.y, n)
      },
      prevPos: {
        x: m(r.prevPos.x, o.prevPos.x, n),
        y: m(r.prevPos.y, o.prevPos.y, n)
      },
      vel: {
        x: m(r.vel.x, o.vel.x, n),
        y: m(r.vel.y, o.vel.y, n)
      }
    });
  }
  for (let l = 0; l < e.entities.length; ++l) {
    s.push(y(e.entities[l], t.entities[l], n, t));
  }
  switch (e.type) {
    case "Rider":
    case "RemountRider":
    case "RemountRider2":
      return {
        framesSinceSledBreak: m(e.framesSinceSledBreak, t.framesSinceSledBreak, n),
        framesSinceUnmount: m(e.framesSinceUnmount, t.framesSinceUnmount, n),
        framesSinceStringDetached: m(e.framesSinceStringDetached, t.framesSinceStringDetached, n),
        entities: s,
        constraints: o,
        points: a
      };
    default:
      return {
        entities: s,
        constraints: o,
        points: a
      };
  }
}
exports.default = h;
module.exports = exports.default;