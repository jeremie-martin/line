Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = f(require("./16.js"));
var i = require("./8.js");
var o = f(require("./630.js"));
var a = f(require("./631.js"));
var s = require("./67.js");
var l = require("./115.js");
var u = f(require("./632.js"));
var c = require("./7.js");
var d = require("./35.js");
function f(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const p = ({
  prevPointer: e,
  pos: t
}) => ({
  active: {
    prevPointer: e,
    pos: t
  }
});
const h = ({
  prevPointer: e
}) => ({
  active: {
    prevPointer: e
  }
});
let m;
exports.default = class extends u.default {
  constructor(e) {
    super();
    this.getState = e.getState;
    this.dispatch = e.dispatch;
    this.zoom = (0, l.toolInactive)();
    this.pan = (0, l.toolInactive)();
  }
  inPlayback() {
    return (0, i.getPlayerRunning)(this.getState());
  }
  inPlaybackFixedCamera() {
    return this.inPlayback() && (0, i.getPlaybackIsFixedPosition)(this.getState());
  }
  toTrackPos(e, {
    position: t,
    zoom: n
  } = (0, i.getEditorCamera)(this.getState())) {
    let o = this.getState();
    var a = (0, i.getEditorDimensions)(o);
    let s = a.width;
    let l = a.height;
    return new r.default(e).sub({
      x: s / 2,
      y: l / 2
    }).div(n).add(t);
  }
  handlePlaybackDisabling(e, t) {
    if (e) {
      if (!t.disabled) {
        this.onPointerUp();
        t = (0, l.toolDisabled)();
      }
    } else if (t.disabled) {
      t = (0, l.toolInactive)();
    }
    return t;
  }
  zoomStart(e) {
    if (this.zoom.inactive) {
      var t = (0, i.getEditorCamera)(this.getState());
      let n = t.position;
      let r = t.zoom;
      if (this.inPlaybackFixedCamera()) {
        n = (0, i.getPlaybackFixedPosition)(this.getState());
        r = (0, i.getPlaybackZoom)(this.getState());
      }
      this.zoom = p({
        prevPointer: e.pos,
        pos: this.toTrackPos(e.pos, {
          position: n,
          zoom: r
        })
      });
    }
  }
  zoomEnd(e) {
    if (this.zoom.active) {
      this.zoom = (0, l.toolInactive)();
    }
  }
  zoomDrag(e, t = false) {
    if (this.zoom.active) {
      let r = this.zoom.active;
      if (this.inPlaybackFixedCamera()) {
        let n = (0, i.getPlaybackFixedPosition)(this.getState());
        let o = (0, i.getPlaybackZoom)(this.getState());
        let a = (0, s.getZoom)(o, e.pos.y - r.prevPointer.y);
        let l = n;
        if (!t) {
          l = (0, s.getPosFromZoom)(r.pos, n, a, o);
        }
        this.dispatch((0, c.setPlaybackPan)(l));
        this.dispatch((0, c.setPlaybackZoom)(a));
      } else if (this.inPlayback()) {
        let t = (0, i.getPlaybackZoom)(this.getState());
        let n = (0, s.getZoom)(t, e.pos.y - r.prevPointer.y);
        this.dispatch((0, c.setPlaybackZoom)(n));
      } else {
        var n = (0, i.getEditorCamera)(this.getState());
        let o = n.position;
        let a = n.zoom;
        let l = (0, s.getZoom)(a, e.pos.y - r.prevPointer.y);
        let u = o;
        if (!t) {
          u = (0, s.getPosFromZoom)(r.pos, o, l, a);
        }
        this.dispatch((0, c.setEditorCamera)(u, l));
      }
      r.prevPointer = e.pos;
    }
  }
  panStart(e) {
    if (this.pan.inactive) {
      this.pan = h({
        prevPointer: e.pos
      });
    }
  }
  panEnd(e) {
    if (this.pan.active) {
      this.pan = (0, l.toolInactive)();
    }
  }
  panDrag(e) {
    if (this.pan.active) {
      let n;
      let o;
      let a = this.pan.active;
      if (this.inPlaybackFixedCamera()) {
        n = (0, i.getPlaybackFixedPosition)(this.getState());
        o = (0, i.getPlaybackZoom)(this.getState());
      } else {
        var t = (0, i.getEditorCamera)(this.getState());
        n = t.position;
        o = t.zoom;
      }
      let s = new r.default(e.pos).sub(a.prevPointer).div(o);
      let l = new r.default(n).sub(s);
      if (this.inPlaybackFixedCamera()) {
        this.dispatch((0, c.setPlaybackPan)(l));
      } else {
        this.dispatch((0, c.setEditorCamera)(l, o));
      }
      a.prevPointer = e.pos;
    }
  }
  onPlaybackStateChange(e) {
    super.onPlaybackStateChange(e);
    if (!(0, i.getPlaybackIsFixedPosition)(this.getState())) {
      this.pan = this.handlePlaybackDisabling(e, this.pan);
    }
  }
  onMiddleButtonDown(e) {
    this.panStart(e);
  }
  onMiddleButtonUp(e) {
    this.panEnd(e);
  }
  onMiddleButtonDrag(e) {
    this.panDrag(e);
  }
  onRightButtonDown(e) {
    this.panStart(e);
  }
  onRightButtonUp(e) {
    this.panEnd(e);
  }
  onRightButtonDrag(e) {
    this.panDrag(e);
  }
  onWheel(e) {
    let t = window.scroll2D;
    var n = (0, i.getEditorCamera)(this.getState());
    let l = n.position;
    let u = n.zoom;
    if (this.inPlayback()) {
      u = (0, i.getPlaybackZoom)(this.getState());
    }
    if (this.inPlaybackFixedCamera()) {
      l = (0, i.getPlaybackFixedPosition)(this.getState());
    }
    let f = 1 / u;
    let p = (0, d.getModifier)(this.getState(), "modifiers.forceZoom");
    if (this.zoomInterpolator) {
      f = this.zoomInterpolator.targetValue;
    }
    let h;
    let m = new r.default(this.posInterpolator ? this.posInterpolator.targetValue : l);
    let y = !t || e.pinch || p;
    let g = y ? 1 / (0, s.getZoom)(1 / f, e.delta.y) : f;
    h = this.inPlayback() && !(0, i.getPlaybackIsFixedPosition)(this.getState()) ? new r.default(l) : y ? (0, s.getPosFromZoom)(this.toTrackPos(e.pos, {
      position: l,
      zoom: u
    }), m, 1 / g, 1 / f) : new r.default(e.delta).mul(f).add(m);
    if (t) {
      this.zoomInterpolator = null;
      this.posInterpolator = null;
      if (this.inPlayback()) {
        if (y) {
          this.dispatch((0, c.setPlaybackZoom)(1 / g));
        }
        if ((0, i.getPlaybackIsFixedPosition)(this.getState())) {
          this.dispatch((0, c.setPlaybackPan)(h));
        }
      } else {
        this.dispatch((0, c.setEditorCamera)(h, 1 / g));
      }
    } else {
      this.zoomInterpolator ||= new o.default(f, 100);
      this.posInterpolator ||= new a.default(m, 100);
      this.zoomInterpolator.setValue(g);
      this.posInterpolator.setValue(h);
      const e = () => {
        if (!this.zoomInterpolator || !this.posInterpolator || this.zoomInterpolator.getInterpolatedValue() === this.zoomInterpolator.targetValue) {
          this.zoomInterpolator = null;
          this.posInterpolator = null;
          return;
        }
        let t = this.posInterpolator.getInterpolatedValue();
        let n = this.zoomInterpolator.getInterpolatedValue();
        if (this.inPlayback()) {
          if (y) {
            this.dispatch((0, c.setPlaybackZoom)(1 / n));
          }
          if ((0, i.getPlaybackIsFixedPosition)(this.getState())) {
            this.dispatch((0, c.setPlaybackPan)(t));
          }
        } else {
          this.dispatch((0, c.setEditorCamera)(t, 1 / n));
        }
        window.requestAnimationFrame(e);
      };
      window.requestAnimationFrame(e);
    }
  }
  checkLifelock() {
    const e = (0, i.getNextFrameLifelock)(this.getState());
    const t = Math.floor((0, i.getPlayerIndex)(this.getState()));
    const n = (0, i.getSimulatorTrack)(this.getState()).getFrame(t);
    let r;
    if (e) {
      r = (0, i.getSimulatorTrack)(this.getState()).getFrame(t + 1);
    }
    const o = (0, i.getNumRiders)(this.getState());
    if (m === undefined) {
      m = Array(o).fill(false).map((t, i) => {
        const o = n.snapshot.entities[0].entities[i].riderState;
        let a = o === "MOUNTED" || o === "REMOUNTING";
        if (e) {
          const e = r.snapshot.entities[0].entities[i].riderState;
          a = a && (e === "MOUNTED" || e === "REMOUNTING");
        }
        return a;
      });
      return false;
    }
    for (let i = 0; i < o; i++) {
      const t = n.snapshot.entities[0].entities[i].riderState;
      let o = t === "MOUNTED" || t === "REMOUNTING";
      if (e) {
        const e = r.snapshot.entities[0].entities[i].riderState;
        o = o && (e === "MOUNTED" || e === "REMOUNTING");
      }
      if (!m[i] && o) {
        m = undefined;
        return true;
      }
      m[i] = o;
    }
    return false;
  }
};
module.exports = exports.default;