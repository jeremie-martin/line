Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./560.js"));
var i = o(require("./16.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const a = {
  maxZoom: 32,
  pull: 0.01,
  push: 0.8,
  roundness: 0.5,
  squareness: 0
};
const s = i.default.from(0, 0);
exports.default = class {
  constructor({
    settings: e = a,
    focus: t = [true, false, false]
  } = {}) {
    this.settings = e;
    this.focus = t;
    this._prevTrack = null;
    this._frames = [];
  }
  isFixed() {
    return this.focus.every(e => e === false);
  }
  toJSON() {
    return {
      settings: this.settings,
      focus: this.focus
    };
  }
  getCamera(e, t, n) {
    if (Number.isInteger(n)) {
      return this._getCameraAtFrame(e, t, n);
    }
    let r = Math.floor(n);
    let i = n - r;
    let o = this._getCameraAtFrame(e, t, r + 1);
    let a = this._getCameraAtFrame(e, t, r);
    return {
      w: a.w + (o.w - a.w) * i,
      h: a.h + (o.h - a.h) * i,
      x: a.x + (o.x - a.x) * i,
      y: a.y + (o.y - a.y) * i,
      dx: a.dx + (o.dx - a.dx) * i,
      dy: a.dy + (o.dy - a.dy) * i
    };
  }
  _getRiderPosition(e, t) {
    let n = this.focus;
    if (window.getCamFocus) {
      n = window.getCamFocus(t);
    }
    const r = e.engine.state.riders.length;
    const o = i.default.from(0, 0);
    let a = 0;
    for (let i = 0; i < r; i++) {
      if (n[i]) {
        const r = typeof n[i] == "number" ? n[i] : 1;
        s.set(e.getRider(t, i).position).mul(r);
        o.add(s);
        a += r;
      }
    }
    if (a > 0) {
      o.div(a);
    }
    return o;
  }
  _getCameraAtFrame(e, t, n) {
    if (window.getAutoZoom) {
      t = Object.assign({}, t, {
        zoom: window.getAutoZoom(n)
      });
    }
    if (window.getCamBounds) {
      var i = window.getCamBounds(n);
      const e = i.w;
      const r = i.h;
      const s = i.x;
      const l = i.y;
      var o = i.px;
      const u = o === undefined ? 0 : o;
      var a = i.py;
      const c = a === undefined ? 0 : a;
      t = Object.assign({}, t, {
        widthScale: e,
        heightScale: r,
        offsetX: s + u * t.zoom / t.width,
        offsetY: l + c * t.zoom / t.height
      });
    }
    this._prevTrack ||= e;
    if (this._prevTrack !== e) {
      if (this._prevTrack.engine.state.riders !== e.engine.state.riders) {
        this._frames = [];
      } else {
        this._frames.splice(n + 1);
        let t = this._frames.length - 1;
        if (this._frames[t].frame !== e.getFrame(t)) {
          for (let n = t - 1; n >= 0; n--) {
            if (this._frames[n].frame === e.getFrame(n)) {
              this._frames.splice(n + 1);
              break;
            }
          }
        }
      }
      this._prevTrack = e;
    }
    if (n < this._frames.length) {
      var s = this._frames[n].params;
      let e = s.zoom;
      let r = s.width;
      let i = s.height;
      let o = s.widthScale;
      let a = s.heightScale;
      let l = s.offsetX;
      let u = s.offsetY;
      if (e !== t.zoom || r !== t.width || i !== t.height || o !== t.widthScale || a !== t.heightScale || l !== t.offsetX || u !== t.offsetY) {
        this._frames.splice(n);
      }
    }
    if (this._frames.length === 0) {
      this._frames = [{
        frame: e.getFrame(0),
        params: t,
        camera: (0, r.default)(this._getRiderPosition(e, 0), this._getRiderPosition(e, 0), t, this.settings)
      }];
    }
    for (let l = this._frames.length; l <= n; l++) {
      let n = this._frames[l - 1].camera;
      let i = this._getRiderPosition(e, l);
      let o = (0, r.default)(n, i, t, this.settings);
      this._frames.push({
        frame: e.getFrame(l),
        params: t,
        camera: o
      });
    }
    if (t.offsetX != null || t.offsetY != null) {
      const e = t.offsetX * t.width / t.zoom;
      const r = t.offsetY * t.height / t.zoom;
      return Object.assign({}, this._frames[n].camera, {
        x: this._frames[n].camera.x + e,
        y: this._frames[n].camera.y + r,
        dx: e,
        dy: r
      });
    }
    return this._frames[n].camera;
  }
};
module.exports = exports.default;