Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = require("./7.js");
var i = require("./8.js");
var o = p(require("./57.js"));
var a = require("./115.js");
var s = require("./67.js");
var l = p(require("./66.js"));
var u = p(require("./107.js"));
var c = require("./127.js");
var d = p(require("./61.js"));
var f = require("./27.js");
function p(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const h = 16;
const m = 1;
const y = {
  Inactive: new l.default(0, 0, 0, 32),
  Active: new l.default(0, 0, 0, 64)
};
const g = e => ({
  active: {
    pos: e,
    changed: false,
    startTime: Date.now()
  }
});
const v = e => ({
  hovered: {
    pos: e
  }
});
const b = e => (0, i.getToolState)(e, f.ERASER_TOOL);
const _ = e => (0, r.setToolState)(f.ERASER_TOOL, e);
exports.default = class extends o.default {
  static getCursor(e) {
    return "inherit";
  }
  static getSceneLayer(e) {
    let t = new u.default(c.TOOL_LAYER);
    const n = b(e).status;
    if (n.active || n.hovered) {
      const r = n.active ? n.active.pos : n.hovered.pos;
      const a = o.default.prototype.toTrackPos.call({
        getState: () => e
      }, r);
      const s = n.active ? y.Active : y.Inactive;
      const l = h * 2 / (0, i.getEditorZoom)(e);
      t = t.withEntityAdded(function (e, t, n, r, i) {
        let o = {
          x: e,
          y: t,
          colorA: r,
          colorB: r,
          thickness: n
        };
        let a = {
          x: e + 0.000001,
          y: t,
          colorA: r,
          colorB: r,
          thickness: n
        };
        return new d.default(o, a, c.TOOL_LAYER, i);
      }(a.x, a.y, l, s, 0));
    }
    return t;
  }
  constructor(e) {
    super(e);
    this.dispatch(_({
      status: (0, a.toolInactive)()
    }));
    Object.defineProperty(this, "eraser", {
      get() {
        return b(this.getState()).status;
      },
      set(e) {
        this.dispatch(_({
          status: e
        }));
      }
    });
  }
  onTrigger(e, t) {
    switch (e) {
      case "triggers.cancel":
        this.cancelEraser();
        break;
      case "triggers.removeLastLine":
      case "triggers.undo":
      case "triggers.redo":
        return !this.eraser.active && t();
      default:
        return t();
    }
  }
  onPlaybackStateChange(e) {
    super.onPlaybackStateChange(e);
    this.eraser = this.handlePlaybackDisabling(e, this.eraser);
  }
  onPointerDown(e) {
    super.onPointerDown();
    if (this.eraser.inactive || this.eraser.hovered) {
      this.eraser = g(e.pos);
      this.onPointerDrag(e);
    }
  }
  onPointerUp(e) {
    if (this.eraser.active) {
      if (this.eraser.active.changed) {
        this.dispatch((0, r.commitTrackChanges)());
      }
      this.eraser = (0, a.toolInactive)();
      if (e && e.pointerType === "mouse") {
        this.onHover(e);
      }
    }
  }
  onPointerDrag(e) {
    if (this.eraser.active) {
      if (this.secondaryTouch) {
        if (Date.now() - this.eraser.active.startTime < s.CANCEL_THRESHOLD) {
          this.cancelEraser();
          return;
        } else {
          this.onPointerUp();
          return;
        }
      }
      let t = this.toTrackPos(e.pos);
      this.eraser = g(e.pos);
      let n = (0, i.getSimulatorTrack)(this.getState()).selectLinesInRadius(t, m + h / (0, i.getEditorZoom)(this.getState()));
      if ((0, i.getTrackLinesLocked)(this.getState())) {
        n = n.filter(e => !e.collidable);
      }
      if (n.length > 0) {
        this.dispatch((0, r.removeLines)(n.map(e => e.id)));
      }
      this.eraser.active.changed = true;
    }
  }
  onHover(e) {
    if (this.eraser.inactive || this.eraser.hovered) {
      this.eraser = v(e.pos);
    }
  }
  cancelEraser() {
    if (this.eraser.active) {
      if (this.eraser.active.changed) {
        this.dispatch((0, r.revertTrackChanges)());
      }
      this.eraser = (0, a.toolInactive)();
    }
  }
};
module.exports = exports.default;