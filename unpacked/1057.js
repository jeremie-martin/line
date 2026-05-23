Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = f(require("./57.js"));
var i = require("./8.js");
var o = require("./260.js");
var a = require("./7.js");
var s = require("./35.js");
var l = require("./1058.js");
var u = f(require("./1059.js"));
var c = require("./29.js");
var d = require("./67.js");
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
  clipboard: [],
  selectedPoints: new Set(),
  multi: false,
  status: o.Status.inactive()
};
let h;
let m = [];
let y = new WeakMap();
let g = new WeakMap();
exports.default = class extends r.default {
  static getCursor(e) {
    if ((0, i.getPlayerRunning)(e)) {
      return "inherit";
    }
    let t = (0, o.getSelectToolState)(e).status;
    if (t.hovered || t.pressed) {
      return "pointer";
    } else if (t.box) {
      return "crosshair";
    } else {
      return "default";
    }
  }
  static getSceneLayer(e) {
    return (0, l.getSceneLayer)(e);
  }
  constructor(e) {
    super(e);
    this.dispatch((0, o.setSelectToolState)(Object.assign({}, p, {
      clipboard: m
    })));
    Object.defineProperty(this, "select", {
      get() {
        return (0, o.getSelectToolState)(this.getState()).status;
      },
      set(e) {
        this.dispatch((0, o.setSelectToolState)({
          status: e
        }));
      }
    });
    h ||= new u.default();
  }
  onTrigger(e, t) {
    let n = this.select.inactive || this.select.hovered;
    switch (e) {
      case "triggers.cancel":
        this.cancelSelect();
        break;
      case "triggers.toggleTrackLinesLocked":
        {
          let e = t();
          if ((0, i.getTrackLinesLocked)(this.getState())) {
            let e = (0, o.getSelectToolState)(this.getState()).selectedPoints;
            e = (0, o.filterNonCollidingPoints)(this.getState(), e);
            this.dispatch((0, o.setSelectToolState)({
              multi: e.size > 0,
              selectedPoints: e
            }));
          }
          return e;
        }
      case "triggers.select.deselect":
        if (this.select.box) {
          this.select = o.Status.inactive();
        } else {
          this.dispatch((0, o.setSelectToolState)({
            selectedPoints: p.selectedPoints
          }));
        }
        break;
      case "triggers.select.cut":
      case "triggers.select.copy":
        {
          let t = this.getState();
          let r = (0, o.getSelectToolState)(t).selectedPoints;
          m = (0, o.copyLinesFromPoints)(t, r, true);
          this.dispatch((0, o.setSelectToolState)({
            clipboard: m
          }));
          if (e === "triggers.select.cut" && n && r.size > 0) {
            this.setSelectHistory(y);
            this.dispatch((0, a.removeLines)((0, o.getLinesFromPoints)(r)));
            this.dispatch((0, a.commitTrackChanges)());
            this.dispatch((0, o.setSelectToolState)({
              selectedPoints: p.selectedPoints,
              multi: p.multi
            }));
            this.setSelectHistory(g);
          }
          break;
        }
      case "triggers.select.paste":
        {
          let e = this.getState();
          if (m && m.length > 0) {
            this.addAndSelectLines((0, o.pasteLines)(e, m), true, true);
          }
          break;
        }
      case "triggers.select.flatPaste":
        {
          let e = this.getState();
          if (m && m.length > 0) {
            this.addAndSelectLines((0, o.pasteLines)(e, m), true);
          }
          break;
        }
      case "triggers.select.clipboard.copy":
        {
          let e = this.getState();
          let t = (0, o.getSelectToolState)(e).selectedPoints;
          let n = (0, o.copyLinesFromPoints)(e, t, true);
          if (n.length > 0) {
            h.copy((0, o.createCopiedSelection)(e, n), this.resolveCopy, this.dispatch);
          }
          break;
        }
      case "triggers.select.clipboard.paste":
        {
          let e = this.getState();
          h.getClipboard(t => {
            if (t) {
              try {
                if (t.lines !== undefined && t.lines.length > 0) {
                  if (t.layers === undefined) {
                    this.addAndSelectLines((0, o.pasteLines)(e, t.lines), true);
                  } else {
                    var n = (0, o.pasteLayeredLines)(e, t);
                    const r = n.newLines;
                    const i = n.newLayers;
                    for (const e of i) {
                      this.dispatch((0, a.addLayer)(e));
                    }
                    this.addAndSelectLines((0, o.pasteLines)(e, r), true, true);
                  }
                }
              } catch (e) {
                this.dispatch((0, c.showNotification)("Failed to paste", true));
              }
            } else {
              this.dispatch((0, c.showNotification)("Failed to paste", true));
            }
          });
          h.paste();
          break;
        }
      case "triggers.select.duplicate":
        {
          let e = this.getState();
          var r = (0, o.getSelectToolState)(e);
          let t = r.selectedPoints;
          let n = r.multi;
          let i = (0, o.copyLinesFromPoints)(e, t, false);
          if (i.length > 0) {
            this.addAndSelectLines(i, n, true);
          }
          break;
        }
      case "triggers.removeLastLine":
        {
          let e = (0, o.getSelectToolState)(this.getState()).selectedPoints;
          if (!n || !(e.size > 0)) {
            return n && t();
          }
          this.setSelectHistory(y);
          this.dispatch((0, a.removeLines)((0, o.getLinesFromPoints)(e)));
          this.dispatch((0, a.commitTrackChanges)());
          this.dispatch((0, o.setSelectToolState)({
            selectedPoints: p.selectedPoints,
            multi: p.multi
          }));
          this.setSelectHistory(g);
          break;
        }
      case "triggers.undo":
      case "triggers.redo":
        if (n) {
          let n = t();
          let r = (0, i.getSimulatorCommittedLines)(this.getState());
          let a = (e === "triggers.undo" ? y : g).get(r) || {
            selectedPoints: p.selectedPoints,
            multi: p.multi
          };
          this.dispatch((0, o.setSelectToolState)(a));
          return n;
        }
        break;
      default:
        if (!(0, s.getModifier)(this.getState(), "modifiers.select.transformState")) {
          return t();
        }
        switch (e) {
          case "triggers.select.convertToNormal":
            this.convertSelectionLineType(0);
            break;
          case "triggers.select.convertToAccel":
            this.convertSelectionLineType(1);
            break;
          case "triggers.select.convertToScenery":
            this.convertSelectionLineType(2);
            break;
          case "triggers.select.reverseLine":
            this.convertSelectionLineType(null, true, false);
            break;
          case "triggers.select.flipLine":
            this.convertSelectionLineType(null, false, true);
            break;
          case "triggers.select.moveUp":
            this.nudgeSelection(0, -1);
            break;
          case "triggers.select.moveLeft":
            this.nudgeSelection(-1, 0);
            break;
          case "triggers.select.moveDown":
            this.nudgeSelection(0, 1);
            break;
          case "triggers.select.moveRight":
            this.nudgeSelection(1, 0);
        }
    }
  }
  resolveCopy(e, t) {
    switch (e) {
      case u.default.Success:
        t((0, c.showNotification)("Copied!", true));
        break;
      case u.default.TryAgain:
        t((0, c.showNotification)("Try copying again", true));
        break;
      case u.default.Fail:
        t((0, c.showNotification)("Failed to copy", true));
    }
  }
  onPlaybackStateChange(e) {
    super.onPlaybackStateChange(e);
    this.select = this.handlePlaybackDisabling(e, this.select);
  }
  onPointerDown(e) {
    super.onPointerDown();
    if (this.select.inactive || this.select.hovered) {
      let n = this.toTrackPos(e.pos);
      let r = this.getState();
      let i = (0, s.getModifier)(r, "modifiers.select.add");
      let a = (0, s.getModifier)(r, "modifiers.select.subtract");
      let l = (0, s.getModifier)(r, "modifiers.select.singlePoint") || (0, s.getModifier)(r, "modifiers.disablePointSnap");
      let u = (0, o.selectPoints)(r, n, l);
      if (u.size > 0) {
        var t = (0, o.getSelectToolState)(r);
        let e = t.selectedPoints;
        let s = t.multi;
        let l = [...u].some(t => e.has(t));
        if ((i || s) && (!l && i || a)) {
          let t;
          if (i) {
            t = new Set([...e, ...u]);
          } else if (a) {
            t = new Set([...e].filter(e => !u.has(e)));
          }
          this.dispatch((0, o.setSelectToolState)({
            selectedPoints: t,
            multi: true
          }));
        } else {
          if (!s || !l) {
            this.dispatch((0, o.setSelectToolState)({
              multi: false,
              selectedPoints: u
            }));
          }
          this.select = o.Status.pressed({
            startPos: n,
            pointId: (0, o.getSinglePointFromPoints)(u, e),
            lineId: (0, o.getLineFromPoints)(u)
          });
        }
      } else {
        this.select = o.Status.box({
          startPos: n,
          endPos: n
        });
      }
    }
  }
  onPointerUp(e) {
    if (this.select.box) {
      let e = this.getState();
      var t = this.select.box;
      let n = t.startPos;
      let r = t.endPos;
      let i = (0, s.getModifier)(e, "modifiers.select.add");
      let a = (0, s.getModifier)(e, "modifiers.select.subtract");
      let l = (0, s.getModifier)(e, "modifiers.select.singlePoint");
      let u = (0, o.selectPointsFromBox)(e, n, r, l);
      let c = true;
      if (i || a) {
        let t = (0, o.getSelectToolState)(e).selectedPoints;
        if (i) {
          u = new Set([...t, ...u]);
        } else if (a) {
          u = new Set([...t].filter(e => !u.has(e)));
        }
        c = u.size > 0;
      } else if (n === r || u.size === 0) {
        u = p.selectedPoints;
        c = false;
      }
      this.dispatch((0, o.setSelectToolState)({
        multi: c,
        selectedPoints: u
      }));
      this.select = o.Status.inactive();
    }
    if (this.select.pressed) {
      let t = this.getState();
      let r = (0, o.getSelectToolState)(t).multi;
      var n = this.select.pressed;
      let l = n.pointId;
      let u = n.lineId;
      let c = n.changed;
      let d = n.pendingDelta;
      if (d) {
        this.adjustLines(l, u, r, d);
      }
      if (c || d) {
        if ((r || u) && (0, s.getModifier)(t, "modifiers.select.duplicate")) {
          this.setSelectHistory(y);
          this.dispatch((0, a.commitTrackChanges)());
          let e = (0, i.getSimulatorCommittedLines)(t);
          this.selectNewLines(e, r);
          this.setSelectHistory(g);
        } else {
          this.setSelectHistory(y);
          this.dispatch((0, a.commitTrackChanges)());
          this.setSelectHistory(g);
        }
      }
      if (e) {
        this.onHover(e);
      }
    }
  }
  onPointerDrag(e) {
    if (this.select.box) {
      if (this.secondaryTouch && Date.now() - this.select.box.startTime < d.CANCEL_THRESHOLD) {
        this.cancelSelect();
        return;
      }
      let t = this.select.box.startPos;
      let n = this.toTrackPos(e.pos);
      this.select = o.Status.box({
        startPos: t,
        endPos: n
      });
    }
    if (this.select.pressed) {
      if (this.secondaryTouch && Date.now() - this.select.pressed.startTime < d.CANCEL_THRESHOLD) {
        this.cancelSelect();
        return;
      }
      let n = this.getState();
      if ((0, s.getModifier)(n, "modifiers.select.lifelock") && this.checkLifelock()) {
        this.dispatch((0, a.commitTrackChanges)());
        this.cancelSelect();
        return;
      }
      let r = (0, o.getSelectToolState)(n).multi;
      var t = this.select.pressed;
      let i = t.startPos;
      let l = t.pointId;
      let u = t.lineId;
      let c = t.changed;
      let f = this.toTrackPos(e.pos).sub(i);
      if ((0, o.getSelectToolState)(n).selectedPoints.size < o.LINE_ADJUST_THRESHOLD * 2) {
        if (c) {
          this.dispatch((0, a.revertTrackChanges)());
        } else {
          this.select = o.Status.pressed(Object.assign({}, this.select.pressed, {
            changed: true
          }));
        }
        this.adjustLines(l, u, r, f);
      } else {
        if (l != null && !(0, s.getModifier)(n, "modifiers.disablePointSnap")) {
          f = (0, o.adjustSelectionSnap)(n, l, f);
        }
        this.select = o.Status.pressed(Object.assign({}, this.select.pressed, {
          pendingDelta: f
        }));
      }
    }
  }
  cancelSelect() {
    if (this.select.box) {
      this.select = o.Status.inactive();
    }
    if (this.select.pressed) {
      if (this.select.pressed.changed) {
        this.dispatch((0, a.revertTrackChanges)());
      }
      this.select = o.Status.inactive();
    }
  }
  adjustLines(e, t, n, r) {
    let i = this.getState();
    let l = !(0, s.getModifier)(i, "modifiers.disablePointSnap");
    let u = !n && (0, s.getModifier)(i, "modifiers.angleLock");
    let c = !n && (0, s.getModifier)(i, "modifiers.perpAngleLock");
    let d = (n || t) && (0, s.getModifier)(i, "modifiers.select.duplicate");
    let f = (0, o.adjustSelection)(i, e, t, r, l, u, c);
    if (d) {
      f = f.map(e => {
        e.id;
        return function (e, t) {
          var n = {};
          for (var r in e) {
            if (!(t.indexOf(r) >= 0)) {
              if (Object.prototype.hasOwnProperty.call(e, r)) {
                n[r] = e[r];
              }
            }
          }
          return n;
        }(e, ["id"]);
      });
      this.dispatch((0, a.duplicateLines)(f));
    } else {
      this.dispatch((0, a.setLines)(f));
    }
  }
  onHover(e) {
    if (this.select.inactive || this.select.hovered || this.select.pressed) {
      let n = this.getState();
      let r = this.toTrackPos(e.pos);
      let i = (0, s.getModifier)(n, "modifiers.select.singlePoint") || (0, s.getModifier)(n, "modifiers.disablePointSnap");
      let a = (0, s.getModifier)(n, "modifiers.select.subtract");
      let l = (0, o.selectPoints)(n, r, i);
      if (l.size > 0) {
        let e = l;
        var t = (0, o.getSelectToolState)(n);
        let r = t.selectedPoints;
        if (t.multi && !a && [...l].some(e => r.has(e))) {
          e = (0, o.getLineFromPoints)(l) ? (0, o.getLinePointsFromPoints)(r) : r;
        }
        this.select = o.Status.hovered({
          points: e,
          pointId: (0, o.getSinglePointFromPoints)(l, r),
          lineId: (0, o.getLineFromPoints)(l)
        });
      } else if (!this.select.inactive) {
        this.select = o.Status.inactive();
      }
    }
  }
  addAndSelectLines(e, t, n) {
    let r = this.getState();
    let o = (0, i.getSimulatorLines)(r);
    this.setSelectHistory(y);
    if (n) {
      this.dispatch((0, a.duplicateLines)(e));
    } else {
      this.dispatch((0, a.addLines)(e));
    }
    this.dispatch((0, a.commitTrackChanges)());
    this.selectNewLines(o, t);
    this.setSelectHistory(g);
  }
  convertSelectionLineType(e, t, n) {
    let r = this.getState();
    let i = (0, o.getSelectToolState)(r).selectedPoints;
    let s = (0, o.copyLinesFromPoints)(r, i, false, true);
    for (let o of s) {
      if (e != null) {
        o.type = e;
      }
      if (t) {
        let e = o.x1;
        let t = o.y1;
        o.x1 = o.x2;
        o.y1 = o.y2;
        o.x2 = e;
        o.y2 = t;
        o.flipped = !o.flipped;
      }
      if (n) {
        o.flipped = !o.flipped;
      }
    }
    this.setSelectHistory(y);
    this.dispatch((0, a.setLines)(s));
    this.dispatch((0, a.commitTrackChanges)());
    this.setSelectHistory(g);
  }
  nudgeSelection(e, t) {
    let n = this.getState();
    var r = (0, o.getSelectToolState)(n);
    let i;
    let l = r.selectedPoints;
    let u = r.multi;
    if ((0, s.getModifier)(n, "modifiers.select.fineNudge")) {
      e /= 16;
      t /= 16;
    }
    if (u) {
      i = (0, o.copyLinesFromPoints)(n, l, false, true);
      for (let n of i) {
        n.x1 += e;
        n.y1 += t;
        n.x2 += e;
        n.y2 += t;
      }
    } else if (l.size > 0) {
      i = (0, o.nudgeLineRelatively)(n, l, e, t);
    }
    this.setSelectHistory(y);
    this.dispatch((0, a.setLines)(i));
    this.dispatch((0, a.commitTrackChanges)());
    this.setSelectHistory(g);
  }
  selectNewLines(e, t) {
    let n = (0, i.getSimulatorLines)(this.getState());
    let r = new Set();
    e.compareTo(n).forEachPrimitive(e => {
      r.add(e.value.id << 1 | false);
      r.add(e.value.id << 1 | true);
    });
    this.dispatch((0, o.setSelectToolState)({
      multi: t,
      selectedPoints: r
    }));
  }
  setSelectHistory(e) {
    let t = this.getState();
    var n = (0, o.getSelectToolState)(t);
    let r = n.selectedPoints;
    let a = n.multi;
    let s = (0, i.getSimulatorCommittedLines)(t);
    e.set(s, {
      selectedPoints: r,
      multi: a
    });
  }
};
module.exports = exports.default;