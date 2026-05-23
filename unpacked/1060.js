Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = v(require("./16.js"));
var i = v(require("./66.js"));
var o = v(require("./107.js"));
var a = v(require("./61.js"));
var s = require("./127.js");
var l = require("./34.js");
var u = require("./22.js");
var c = require("./7.js");
var d = v(require("./57.js"));
var f = require("./8.js");
var p = require("./67.js");
var h = require("./115.js");
var m = require("./35.js");
var y = require("./27.js");
var g = require("./81.js");
function v(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const b = {
  url1x: `url("${(0, l.toSvgCursorString)(u.PencilWithOutline.Data, 1)}")`,
  url2x: `url("${(0, l.toSvgCursorString)(u.PencilWithOutline.Data, 2)}")`,
  hotspot: {
    x: 2,
    y: 22
  },
  fallback: "auto"
};
const _ = e => (0, c.setToolState)(y.PENCIL_TOOL, e);
const w = e => (0, f.getToolState)(e, y.PENCIL_TOOL);
const x = ({
  screenPos: e,
  prevPos: t,
  flipped: n
}) => ({
  active: {
    prevPos: t,
    pendingPos: t,
    screenPos: e,
    prevVec: null,
    flipped: n,
    changed: false,
    startTime: Date.now()
  }
});
const E = {
  status: (0, h.toolInactive)()
};
const S = 2;
const T = {
  Pending: new i.default(0, 0, 0, 128),
  Target: new i.default(255, 0, 255, 128)
};
function k(e, t, n, r, i, o, l) {
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
  return new a.default(u, c, s.TOOL_LAYER, l);
}
const O = Math.cos(Math.PI / 180 * 1);
exports.default = class extends d.default {
  static get usesSwatches() {
    return true;
  }
  static getCursor(e) {
    if ((0, f.getPlayerRunning)(e)) {
      return "inherit";
    } else if ((0, f.getActiveLayerEditable)(e)) {
      return b;
    } else {
      return "not-allowed";
    }
  }
  static getSceneLayer(e) {
    let t = new o.default(s.TOOL_LAYER);
    const n = w(e).status;
    if (n.active) {
      let i = (0, f.getEditorZoom)(e);
      var r = n.active;
      let o = r.prevPos;
      let a = r.pendingPos;
      let s = r.screenPos;
      const l = d.default.prototype.toTrackPos.call({
        getState: () => e
      }, s);
      let u = (0, f.getSelectedLineType)(e) === g.SCENERY_LINE ? (0, f.getSelectedSceneryWidth)(e) * 2 : S;
      t = (t = t.withEntityAdded(k(a.x, a.y, l.x, l.y, 1 / i, T.Target, 0))).withEntityAdded(k(o.x, o.y, a.x, a.y, u, T.Pending, 1));
    }
    return t;
  }
  constructor(e) {
    super(e);
    this.dispatch(_(E));
    Object.defineProperty(this, "pencil", {
      get() {
        return w(this.getState()).status;
      },
      set(e) {
        this.dispatch(_({
          status: e
        }));
      }
    });
    this.maybeDrawLine = (e = false) => {
      let t = this.pencil.active;
      const n = this.toTrackPos(t.screenPos);
      const i = (0, m.getModifier)(this.getState(), "modifiers.smoothPencil");
      const o = i ? 0.05 : 0.3;
      const a = new r.default(n).sub(t.pendingPos);
      const s = 40 / (0, f.getEditorZoom)(this.getState());
      if (!i && a.len() > s) {
        a.norm().mul(-s).add(n);
      } else {
        a.mul(o);
        a.add(t.pendingPos);
      }
      const l = new r.default(a).sub(t.prevPos);
      const u = l.len();
      const d = u < r.default.dist(t.pendingPos, t.prevPos);
      const h = (0, p.getMinLineLength)(this.getState(), 0.8);
      const y = u >= h;
      const g = u >= h * 10;
      l.div(u);
      const v = !t.prevVec || l.dot(t.prevVec) < O;
      t.pendingPos = a;
      if (!g && (!y || !e && !d && !v)) {
        this.pencil = {
          active: t
        };
        return;
      }
      let b = {
        x1: t.prevPos.x,
        y1: t.prevPos.y,
        x2: a.x,
        y2: a.y,
        flipped: t.flipped,
        type: (0, f.getSelectedLineType)(this.getState()),
        width: (0, f.getSelectedSceneryWidth)(this.getState())
      };
      this.dispatch((0, c.addLine)(b));
      t.prevVec = l;
      t.prevPos = a;
      t.changed = true;
      this.pencil = {
        active: t
      };
    };
  }
  onTrigger(e, t) {
    switch (e) {
      case "triggers.cancel":
        this.cancelPencil();
        break;
      case "triggers.removeLastLine":
      case "triggers.undo":
      case "triggers.redo":
        return !this.pencil.active && t();
      default:
        return t();
    }
  }
  onPlaybackStateChange(e) {
    super.onPlaybackStateChange(e);
    this.pencil = this.handlePlaybackDisabling(e, this.pencil);
  }
  onPointerDown(e) {
    super.onPointerDown();
    const t = this.getState();
    if ((0, f.getActiveLayerEditable)(t) && this.pencil.inactive) {
      const n = !(0, m.getModifier)(t, "modifiers.disablePointSnap");
      const r = this.toTrackPos(e.pos);
      const i = (0, m.getModifier)(t, "modifiers.flipLine");
      const o = {
        type: (0, f.getSelectedLineType)(t),
        isRightSide: i
      };
      const a = o.type === 0 || o.type === 1;
      this.pencil = x({
        screenPos: e.pos,
        prevPos: n && a ? (0, p.getPointSnapPos)(r, t, o, null, null, true) : r,
        flipped: i
      });
      this.pencilTimer = setInterval(this.maybeDrawLine, 1000 / 60);
    }
  }
  onPointerUp(e) {
    if (this.pencil.active) {
      this.maybeDrawLine(true);
      if (this.pencil.active.changed) {
        this.dispatch((0, c.commitTrackChanges)());
      }
      this.pencil = (0, h.toolInactive)();
      clearInterval(this.pencilTimer);
    }
  }
  onPointerDrag(e) {
    if (this.pencil.active) {
      if (this.secondaryTouch) {
        if (Date.now() - this.pencil.active.startTime < p.CANCEL_THRESHOLD) {
          this.cancelPencil();
          return;
        } else {
          this.onPointerUp();
          return;
        }
      }
      let t = this.pencil.active;
      t.screenPos = e.pos;
      this.pencil = {
        active: t
      };
    }
  }
  cancelPencil() {
    if (this.pencil.active) {
      if (this.pencil.active.changed) {
        this.dispatch((0, c.revertTrackChanges)());
      }
      this.pencil = (0, h.toolInactive)();
      clearInterval(this.pencilTimer);
    }
  }
};
module.exports = exports.default;