Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = require("./7.js");
var i = require("./8.js");
var o = h(require("./57.js"));
var a = require("./115.js");
var s = require("./67.js");
var l = h(require("./66.js"));
var u = h(require("./107.js"));
var c = require("./127.js");
var d = h(require("./61.js"));
var f = h(require("./16.js"));
var p = require("./27.js");
function h(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const m = (e, t) => ({
  active: {
    startPos: e,
    index: t,
    changed: false,
    startTime: Date.now()
  }
});
const y = e => ({
  hovered: {
    index: e
  }
});
const g = e => (0, i.getToolState)(e, p.ADJUST_START_TOOL);
const v = e => (0, r.setToolState)(p.ADJUST_START_TOOL, e);
const b = 8;
const _ = {
  Inactive: new l.default(0, 0, 0, 32),
  Active: new l.default(0, 0, 0, 64)
};
exports.default = class extends o.default {
  static getCursor(e) {
    if ((0, i.getPlayerRunning)(e)) {
      return "inherit";
    }
    let t = g(e).status;
    if (t.hovered || t.active) {
      return "pointer";
    } else {
      return "default";
    }
  }
  static getSceneLayer(e) {
    const t = (0, i.getRiders)(e);
    let n = new u.default(c.TOOL_LAYER);
    const r = g(e).status;
    t.forEach(({
      startPosition: e
    }, t) => {
      const i = r.hovered && r.hovered.index === t;
      const o = r.active && r.active.index === t;
      const a = o || i ? _.Active : _.Inactive;
      const s = o ? b * 4 : b * 2;
      n = n.withEntityAdded(function (e, t, n, r, i) {
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
      }(e.x, e.y, s, a, t));
    });
    return n;
  }
  constructor(e) {
    super(e);
    this.dispatch(v({
      status: (0, a.toolInactive)()
    }));
    Object.defineProperty(this, "adjustStart", {
      get() {
        return g(this.getState()).status;
      },
      set(e) {
        this.dispatch(v({
          status: e
        }));
      }
    });
  }
  onTrigger(e, t) {
    switch (e) {
      case "triggers.cancel":
        this.cancelAdjustStart();
        break;
      case "triggers.removeLastLine":
      case "triggers.undo":
      case "triggers.redo":
        return !this.adjustStart.active && t();
      default:
        return t();
    }
  }
  onPlaybackStateChange(e) {
    super.onPlaybackStateChange(e);
    this.adjustStart = this.handlePlaybackDisabling(e, this.adjustStart);
  }
  getClosestRiderIndex(e) {
    const t = (0, i.getRiders)(this.getState());
    let n = b;
    let r = -1;
    t.forEach(({
      startPosition: t
    }, i) => {
      const o = f.default.dist(t, e);
      if (o < n) {
        n = o;
        r = i;
      }
    });
    return r;
  }
  onPointerDown(e) {
    super.onPointerDown();
    if (!this.adjustStart.active) {
      const t = this.toTrackPos(e.pos);
      const n = this.getClosestRiderIndex(t);
      if (n > -1) {
        this.adjustStart = m(t, n);
      }
    }
  }
  onPointerUp(e) {
    if (this.adjustStart.active) {
      if (this.adjustStart.active.changed) {
        this.dispatch((0, r.commitTrackChanges)());
      }
      this.adjustStart = (0, a.toolInactive)();
      if (e) {
        this.onHover(e);
      }
    }
  }
  onHover(e) {
    if (!this.adjustStart.active) {
      const t = this.toTrackPos(e.pos);
      const n = this.getClosestRiderIndex(t);
      if (n > -1) {
        this.adjustStart = y(n);
      } else if (this.adjustStart.hovered) {
        this.adjustStart = (0, a.toolInactive)();
      }
    }
  }
  onPointerDrag(e) {
    if (this.adjustStart.active) {
      if (this.secondaryTouch) {
        if (Date.now() - this.adjustStart.active.startTime < s.CANCEL_THRESHOLD) {
          this.cancelAdjustStart();
          return;
        } else {
          this.onPointerUp();
          return;
        }
      }
      const t = this.adjustStart.active;
      if (t.changed) {
        this.dispatch((0, r.revertTrackChanges)());
      }
      let n = this.toTrackPos(e.pos).sub(t.startPos);
      let o = (0, i.getRiders)(this.getState());
      let a = o[t.index];
      a = Object.assign({}, a, {
        startPosition: n.add(a.startPosition)
      });
      (o = [...o]).splice(t.index, 1, a);
      this.dispatch((0, r.setRiders)(o));
      this.adjustStart.active.changed = true;
    }
  }
  cancelAdjustStart() {
    if (this.adjustStart.active) {
      if (this.adjustStart.active.changed) {
        this.dispatch((0, r.revertTrackChanges)());
      }
      this.adjustStart = (0, a.toolInactive)();
    }
  }
};
module.exports = exports.default;