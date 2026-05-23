Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./7.js");
var o = require("./8.js");
var a = require("./67.js");
var s = require("./57.js");
var l = (r = s) && r.__esModule ? r : {
  default: r
};
var u = require("./115.js");
var c = require("./35.js");
const d = ({
  startPos: e,
  flipped: t
}) => ({
  active: {
    startPos: e,
    flipped: t,
    changed: false,
    startTime: Date.now()
  }
});
exports.default = class extends l.default {
  static get usesSwatches() {
    return true;
  }
  static getCursor(e) {
    if ((0, o.getPlayerRunning)(e)) {
      return "inherit";
    } else if ((0, o.getActiveLayerEditable)(e)) {
      return "crosshair";
    } else {
      return "not-allowed";
    }
  }
  constructor(e) {
    super(e);
    this.line = (0, u.toolInactive)();
  }
  onTrigger(e, t) {
    switch (e) {
      case "triggers.cancel":
        this.cancelLine();
        break;
      case "triggers.removeLastLine":
      case "triggers.undo":
      case "triggers.redo":
        return !this.line.active && t();
      default:
        return t();
    }
  }
  shouldPointSnap(e) {
    const t = (0, c.getModifier)(this.getState(), "modifiers.disablePointSnap");
    const n = (0, c.getModifier)(this.getState(), "modifiers.angleSnap");
    return !t && (e || !n);
  }
  shouldAngleSnap() {
    return (0, c.getModifier)(this.getState(), "modifiers.angleSnap");
  }
  onPlaybackStateChange(e) {
    super.onPlaybackStateChange(e);
    this.line = this.handlePlaybackDisabling(e, this.line);
  }
  onPointerDown(e) {
    super.onPointerDown();
    let t = this.getState();
    if ((0, o.getActiveLayerEditable)(t) && this.line.inactive) {
      let n = this.toTrackPos(e.pos);
      const r = (0, c.getModifier)(t, "modifiers.flipLine");
      const i = {
        type: (0, o.getSelectedLineType)(t),
        isRightSide: r
      };
      this.line = d({
        startPos: this.shouldPointSnap(true) ? (0, a.getPointSnapPos)(n, t, i, null, null, true) : n,
        flipped: r
      });
    }
  }
  onPointerUp(e) {
    if (this.line.active) {
      if (this.line.active.changed) {
        this.dispatch((0, i.commitTrackChanges)());
      }
      this.line = (0, u.toolInactive)();
    }
  }
  onPointerDrag(e) {
    if (this.line.active) {
      if (this.secondaryTouch && Date.now() - this.line.active.startTime < a.CANCEL_THRESHOLD) {
        this.cancelLine();
        return;
      }
      let t = this.line.active;
      let n = this.getState();
      let r = this.toTrackPos(e.pos);
      if (r.dist(t.startPos) < (0, a.getMinLineLength)(n)) {
        return;
      }
      if ((0, c.getModifier)(n, "modifiers.select.lifelock") && this.checkLifelock()) {
        this.dispatch((0, i.commitTrackChanges)());
        this.cancelLine();
        return;
      }
      if (t.changed) {
        this.dispatch((0, i.revertTrackChanges)());
      }
      const s = t.flipped;
      const l = {
        type: (0, o.getSelectedLineType)(n),
        isRightSide: !s
      };
      r = this.shouldPointSnap() ? (0, a.getPointSnapPos)(r, n, l, null, t.startPos, false) : r;
      let u = (0, c.getModifier)(n, "modifiers.angleLock");
      let d = (0, c.getModifier)(n, "modifiers.angleSnap");
      if (u && t.startPos.vec) {
        r = (0, a.getAngleLockPos)(r, t.startPos, t.startPos.vec);
      } else if (d) {
        r = (0, a.getAngleSnapPos)(r, t.startPos);
      }
      let f = {
        x1: t.startPos.x,
        y1: t.startPos.y,
        x2: r.x,
        y2: r.y,
        flipped: s,
        type: l.type,
        width: (0, o.getSelectedSceneryWidth)(n)
      };
      this.dispatch((0, i.addLine)(f));
      t.changed = true;
    }
  }
  cancelLine() {
    if (this.line.active) {
      if (this.line.active.changed) {
        this.dispatch((0, i.revertTrackChanges)());
      }
      this.line = (0, u.toolInactive)();
    }
  }
};
module.exports = exports.default;