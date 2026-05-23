Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = require("./8.js");
var i = require("./7.js");
require("./26.js");
var o = require("./113.js");
let a = function () {};
a = require("./618.js");
const s = {
  PlaybackEngine: class {
    constructor(e) {
      this.store = e;
      this.running = false;
      this.step = this.step.bind(this);
    }
    start() {
      this.prevTime = window.performance.now();
      this.raf = window.requestAnimationFrame(this.step);
      this.running = true;
    }
    stop() {
      window.cancelAnimationFrame(this.raf);
      this.running = false;
    }
    step() {
      let e = this.store.getState();
      if ((!e.player.fastForward && !e.player.rewind || (0, r.getPlayerRunning)(e)) && !(0, r.getPlayerRunning)(e)) {
        return;
      }
      const t = (0, r.getPlayerFrameRateSetting)(e);
      let n = (0, r.getPlayerIndex)(e);
      let o = (0, r.getPlayerFps)(e);
      let s = n / o;
      let l = (0, r.getCurrentPlayerRate)(e);
      let u = (0, r.getPlayerReversed)(e) ? -1 : 1;
      let c = window.performance.now();
      let d = (c - this.prevTime) / 1000;
      d *= l;
      let f = false;
      if (window.timeRemapper) {
        let e = window.timeRemapper.physicsToReal(s);
        let n = e + d * u;
        if (n < 0) {
          f = true;
        }
        if (typeof t == "number") {
          n = Math.round(n * t) / t;
        }
        let r = window.timeRemapper.realToPhysics(n);
        let i = Math.abs(r - s);
        l *= i / d;
        d = i;
        if (Math.abs(e - n) < 1e-9) {
          d = 0;
        }
      }
      let p = d * o;
      if (t === false) {
        p = Math.floor(p);
      }
      if (!window.timeRemapper && typeof t == "number") {
        p = Math.floor(p / o * t) / t * o;
      }
      let h = n + p * u;
      if (h < 0 || f) {
        h = 0;
        this.prevTime = c;
      }
      if (h !== n && h >= 0) {
        this.prevTime += p / o / l * 1000;
        if (!e.player.scrubbing) {
          this.store.dispatch((0, i.setFrameIndex)(h));
        }
      }
      a();
      this.raf = window.requestAnimationFrame(this.step);
    }
  }
};
exports.default = ({
  PlaybackEngine: e
} = s) => t => {
  let n = new e(t);
  return e => function (a) {
    const s = (0, r.getPlayerFrameRateSetting)(t.getState());
    if (typeof s == "number" && (a.type === i.INC_PLAYER_INDEX || a.type === i.DEC_PLAYER_INDEX)) {
      let e = t.getState();
      const n = (0, r.getPlayerIndex)(e);
      const o = (0, r.getPlayerFps)(e);
      const l = a.type === i.INC_PLAYER_INDEX ? 1 : -1;
      if (!window.timeRemapper) {
        return t.dispatch((0, i.setFrameIndex)(Math.round(n / o * s + l) / s * o));
      }
      let u = n / o;
      let c = window.timeRemapper.physicsToReal(u) + 1 / s * l;
      c = Math.round(c * s) / s;
      let d = window.timeRemapper.realToPhysics(c);
      return t.dispatch((0, i.setFrameIndex)(d * o));
    }
    let c = e(a);
    let d = t.getState();
    let f = (0, r.getPlayerRunning)(d) || d.player.fastForward || d.player.rewind;
    const p = (0, r.getPlayerIndex)(d);
    const h = (0, r.getPlayerFrameRateSetting)(d);
    if (s !== h && (h === false && t.dispatch((0, i.setFrameIndex)(Math.round(p))), !window.timeRemapper && typeof h == "number")) {
      const e = (0, r.getPlayerFps)(d);
      t.dispatch((0, i.setFrameIndex)(Math.round(p / e * h) / h * e));
    }
    if (!n.running && f) {
      n.start();
    }
    if (n.running && !f) {
      n.stop();
    }
    if (d[l][u] && d.player.index > 1200) {
      t.dispatch((0, i.setFrameIndex)(1200));
      if ((0, r.getPlayerRunning)(d)) {
        t.dispatch((0, o.setEditorCameraToPlaybackCamera)());
        t.dispatch((0, i.setPlayerRunning)(false));
      }
    }
    return c;
  };
};
const l = 27876 .toString(36).toLowerCase() + function () {
  var e = Array.prototype.slice.call(arguments);
  var t = e.shift();
  return e.reverse().map(function (e, n) {
    return String.fromCharCode(e - t - 9 - n);
  }).join("");
}(63, 189, 183, 173) + 14 .toString(36).toLowerCase();
const u = 29 .toString(36).toLowerCase() + function () {
  var e = Array.prototype.slice.call(arguments);
  var t = e.shift();
  return e.reverse().map(function (e, n) {
    return String.fromCharCode(e - t - 9 - n);
  }).join("");
}(7, 122, 130) + 381 .toString(36).toLowerCase();
module.exports = exports.default;