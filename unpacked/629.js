Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, {
  fps: t,
  smoothPlayback: n,
  hq: _,
  precompute: w
}) {
  window.V2 = g.default;
  0;
  0;
  if (typeof window.onAppReady == "function") {
    setTimeout(window.onAppReady);
  }
  let O;
  Object.defineProperties(window, {
    fps: {
      get: () => (0, u.getPlayerFps)(e.getState()),
      set: t => e.dispatch((0, c.setPlayerFps)(t))
    },
    store: {
      get: () => {
        if (r.default.isSetup()) {
          r.default.uninstall();
        }
        return e;
      }
    },
    getCamFocus: {
      get: () => O,
      set(t) {
        e.getState().camera.playbackFollower._frames.length = 0;
        O = t;
      }
    }
  });
  if (t != null) {
    t = parseInt(t);
    if (Number.isFinite(t) && t > 0) {
      window.fps = t;
    }
  }
  switch (n) {
    case "false":
      e.dispatch((0, c.setInterpolate)(false));
      break;
    case "60":
      e.dispatch((0, c.setInterpolate)(60));
  }
  window.hq = _ !== undefined;
  window.precompute = w !== undefined;
  window.Tools = s.Tools;
  window.DefaultTool = l.default;
  window.loadAudioFile = t => e.dispatch((0, p.loadAudioFile)(t));
  window.createLineFromJson = f.createFastLineFromJson;
  window.React = i;
  window.ReactDOM = o;
  window.addModMiddleware = d.addModMiddleware;
  window.addCircle = function (t, n, r = 0, i = 0, o = (0, u.getSelectedLineType)(e.getState()), s = false, l = (0, u.getSelectedSceneryWidth)(e.getState())) {
    if (typeof s != "boolean" || !Number.isInteger(o) || !(o >= 0) || !(o <= 2) || !Number.isFinite(r) || !Number.isFinite(i) || !Number.isFinite(t) || !Number.isInteger(n) || !(n > 0) || !(l > 0) || !(l < 100)) {
      return console.error("invalid circle");
    }
    const c = Math.PI * 2 / -n;
    for (let u = 0; u < n; ++u) {
      e.dispatch((0, a.addLine)({
        x1: Math.cos(c * u) * t + r,
        y1: Math.sin(c * u) * t + i,
        x2: Math.cos(c * (u + 1)) * t + r,
        y2: Math.sin(c * (u + 1)) * t + i,
        flipped: false,
        type: o,
        width: l
      }));
    }
  };
  window.addLine = function (t, n, r, i, o = (0, u.getSelectedLineType)(e.getState()), s = false, l = (0, u.getSelectedSceneryWidth)(e.getState())) {
    if (typeof s != "boolean" || !Number.isInteger(o) || !(o >= 0) || !(o <= 2) || !Number.isFinite(t) || !Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(i) || !(l > 0) || !(l < 100)) {
      return console.error("invalid line");
    }
    e.dispatch((0, a.addLine)({
      x1: t,
      y1: n,
      x2: r,
      y2: i,
      flipped: s,
      type: o,
      width: l
    }));
  };
  window.perfTest = function (t) {
    if (!Number.isInteger(t) || !(t > 0)) {
      return console.error("invalid numLines");
    }
    const n = Math.floor(Math.sqrt(t));
    let r = [];
    for (let e = 0; e < n; ++e) {
      for (let t = 0; t < n; ++t) {
        let n = t * 5;
        let i = e * 5;
        let o = n + 5;
        let a = i + 5;
        r.push({
          x1: n,
          y1: i,
          x2: o,
          y2: a,
          type: 0
        });
      }
    }
    e.dispatch((0, a.addLines)(r));
  };
  (0, h.default)(e);
  window.hideViewportFrame = false;
  window.activationPing = () => {
    e.dispatch((0, c.ping)());
  };
  window.cancelGesture = () => {
    e.dispatch((0, m.triggerCommand)("triggers.cancel"));
  };
  window.showTouches = S;
  window.setRemountFactors = (t = 2, n = 0.1) => {
    const r = t * 0.057;
    const i = n;
    const o = (0, u.getSimulatorTrack)(e.getState());
    for (let e of y.default.constraints) {
      if (e.type === "RemountStick") {
        e.remountEndurance = r;
        e.remountStrength = i;
      }
    }
    x(o);
  };
  window.loadTrackFromString = t => {
    e.dispatch((0, v.loadTrackFromString)(t));
    e.dispatch((0, c.enterEditor)());
  };
  0;
  window.downloadPhysicsStats = (t = 0) => {
    const n = Math.floor((0, u.getPlayerIndex)(e.getState()));
    const r = (0, u.getSimulatorTrack)(e.getState());
    const i = Array(n + 1).fill().map((e, n) => (0, b.getPhysicsStats)(r, n, t).join(",")).join("\n");
    var o = window.document.createElement("a");
    o.href = window.URL.createObjectURL(new Blob([i], {
      type: "text/csv"
    }));
    o.download = "stats.csv";
    document.body.appendChild(o);
    o.click();
    document.body.removeChild(o);
  };
  window.registerCustomSetting = t => {
    console.info("Registering custom setting", t.name);
    e.dispatch((0, c.registerModSetting)(t));
  };
  window.registerCustomTool = (t, n, r, i, o) => {
    console.info("Registering custom tool", t);
    window.Tools[t] = n;
    e.dispatch((0, c.registerModTool)(t, n, r, o));
  };
  window.setTimeout(() => {
    if (typeof window.onCustomToolsApiReady == "function") {
      window.onCustomToolsApiReady();
    }
  }, 100);
  window.createLayerAutomator = function () {
    let e = {};
    let t = false;
    let n = {};
    const r = (r, i) => {
      if (t) {
        i = Math.round(i * 1.5);
      }
      if (!(r in e)) {
        return true;
      }
      const o = e[r];
      let a = o[n[r]][1];
      if (n[r] < o.length - 1 && o[n[r] + 1][0] <= i) {
        n[r] += 1;
        a = o[n[r]][1];
      }
      if (n[r] < o.length - 1 && (!(o[n[r]][0] <= i) || !(i < o[n[r] + 1][0])) || n[r] === o.length - 1 && !(o[n[r]][0] <= i)) {
        n[r] = E(i, o);
        a = o[n[r]][1];
      }
      return a.off === 0 || a.on !== 0 && (i + a.offset) % (a.on + a.off) < a.on;
    };
    return function (i, o) {
      t = o;
      e = {};
      n = {};
      for (const t of Object.keys(i)) {
        const r = i[t];
        if (!(t in e)) {
          e[t] = [];
          n[t] = 0;
        }
        for (const n of r) {
          e[t].push([n[0][0] * 2400 + n[0][1] * 40 + n[0][2], {
            on: n[1].on,
            off: n[1].off,
            offset: n[1].offset
          }]);
        }
      }
      return r;
    };
  }();
  Object.defineProperty(window.createLayerAutomator, "help", {
    get() {
      console.log(T);
    }
  });
  window.setCustomGravity = function () {
    const e = window.store.getState().simulator.engine.getFrame(0).snapshot.entities[0].entities[0].points.length;
    let t = window.store.getState().simulator.engine.engine.state.riders.length;
    let n = 0;
    let r = 0;
    let i = {};
    let o = [];
    function a(e) {
      t = e.engine.state.riders.length;
      n = 0;
      r = 0;
      for (let t = 0; t < o.length; t++) {
        o[t] = 0;
      }
      x(e);
    }
    function s() {
      let a = undefined;
      const s = i[r];
      if (s !== undefined && s.length !== 0) {
        const e = window.store.getState().simulator.engine.engine._computed._frames.length - 1;
        a = s[o[r]][1];
        if (o[r] < s.length - 1 && s[o[r] + 1][0] <= e) {
          o[r] += 1;
          a = s[o[r]][1];
        }
        if (o[r] < s.length - 1 && (!(s[o[r]][0] <= e) || !(e < s[o[r] + 1][0])) || o[r] === s.length - 1 && !(s[o[r]][0] <= e)) {
          o[r] = E(e, s);
          a = s[o[r]][1];
        }
      }
      if (a === undefined) {
        a = {
          x: 0,
          y: 0.175
        };
      }
      if ((n += 1) === e) {
        n = 0;
        r += 1;
      }
      if (r === t) {
        r = 0;
      }
      return a;
    }
    window.store.subscribe(() => {
      if (t !== (0, u.getNumRiders)(window.store.getState())) {
        a((0, u.getSimulatorTrack)(window.store.getState()));
      }
    });
    return function (e) {
      i = {};
      o = [];
      for (let t = 0; t < e.length; t++) {
        const n = e[t];
        i[t] = [];
        o.push(0);
        for (const e of n) {
          i[t].push([e[0][0] * 2400 + e[0][1] * 40 + e[0][2], e[1]]);
        }
      }
      a((0, u.getSimulatorTrack)(window.store.getState()));
      Object.defineProperty(window.$ENGINE_PARAMS, "gravity", {
        get: s
      });
    };
  }();
  Object.defineProperty(window.setCustomGravity, "help", {
    get() {
      console.log(k);
    }
  });
};
var r = w(require("./82.js"));
var i = _(require("./0.js"));
var o = _(require("./21.js"));
require("./26.js");
var a = require("./277.js");
var s = require("./146.js");
var l = w(require("./57.js"));
var u = require("./8.js");
var c = require("./7.js");
var d = require("./314.js");
var f = require("./143.js");
var p = require("./110.js");
var h = w(require("./633.js"));
var m = require("./39.js");
var y = w(require("./295.js"));
var g = w(require("./16.js"));
var v = require("./149.js");
var b = require("./315.js");
function _(e) {
  if (e && e.__esModule) {
    return e;
  }
  var t = {};
  if (e != null) {
    for (var n in e) {
      if (Object.prototype.hasOwnProperty.call(e, n)) {
        t[n] = e[n];
      }
    }
  }
  t.default = e;
  return t;
}
function w(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function x(e) {
  const t = e.engine._computed;
  t._frames = [t._getInitialFrame()];
  const n = (0, u.getPlayerIndex)(window.store.getState());
  window.store.dispatch((0, c.setFrameIndex)(0));
  requestAnimationFrame(() => {
    window.store.dispatch((0, c.setFrameIndex)(n));
  });
}
function E(e, t) {
  let n = 0;
  let r = t.length - 1;
  while (n < r) {
    const i = Math.ceil((r + n) / 2);
    if (e < t[i][0]) {
      r = i - 1;
    } else {
      n = i;
    }
  }
  return n;
}
function S() {
  const e = document.createElement("style");
  document.head.appendChild(e);
  e.sheet.insertRule(".show-touch {\n    transition: background-color 0.1s ease-in,\n      border-color 0.1s ease-in,\n      width 0.1s ease-in,\n      height 0.1s ease-in;\n    background-color: rgba(0,0,0,0.1);\n    border: 1px solid rgba(0,0,0,0.4);\n    border-radius: 50%;\n    position: fixed;\n    pointer-events: none;\n    width: 48px;\n    height: 48px;\n    transform: translate(-50%, -50%);\n    z-index: 1000000;\n  }", 0);
  e.sheet.insertRule(".show-touch-end {\n    background-color: rgba(0,0,0,0);\n    border: 1px solid rgba(0,0,0,0);\n    width: 120px;\n    height: 120px;\n  }", 1);
  const t = new Map();
  window.addEventListener("touchstart", e => {
    for (let n of e.changedTouches) {
      const e = document.body.appendChild(document.createElement("div"));
      e.className = "show-touch";
      e.style.left = n.clientX + "px";
      e.style.top = n.clientY + "px";
      t.set(n.identifier, e);
    }
  });
  window.addEventListener("touchmove", e => {
    for (let n of e.changedTouches) {
      const e = t.get(n.identifier);
      e.style.left = n.clientX + "px";
      e.style.top = n.clientY + "px";
    }
  });
  const n = e => {
    for (let n of e.changedTouches) {
      const e = t.get(n.identifier);
      t.delete(n.identifier);
      e.style.left = n.clientX + "px";
      e.style.top = n.clientY + "px";
      e.classList.add("show-touch-end");
      setTimeout(() => {
        e.remove();
      }, 100);
    }
  };
  window.addEventListener("touchend", n);
  window.addEventListener("touchcancel", n);
}
const T = "\nUsage: getLayerVisibleAtTime = createLayerAutomator(keyframes, [sixty_fps])\n\nkeyframes:\n{\n  0: [\n    [[minutes, seconds, frames], layerCycles],\n    ...\n  ],\n  1: [...],\n  ...\n}\nwhere 0, 1, ... are layer ids\n\nlayerCycles:\n{ on: number, off: number, offset: number }\non represents how long this layer is on for during the cycle\nand off represents how long this layer is off\noffset represents how many frames into the cycle it starts\n\nsixty_fps:\nmakes automator work with sixty fps instead of forty fps\n\nExample:\ngetLayerVisibleAtTime = createLayerAutomator({\n  0: [\n    [[0, 0, 0], {on: 1, off: 0, offset: 0}]\n  ], // Keep layer 0 on\n  1: [\n    [[0, 0, 0], {on: 0, off: 1, offset: 0}],\n    [[0, 1, 0], {on: 1, off: 0, offset: 0}]\n  ], // Turn layer 1 off, then turn it on after a second\n  2: [\n    [[0, 0, 0], {on: 2, off: 2, offset: 0}]\n  ], // Toggle layer 2 every 2 frames\n})\n";
const k = "\nUsage: setCustomGravity(keyframes)\n\nkeyframes:\n[\n  [\n    [[minutes, seconds, frames], gravity],\n    ...\n  ],\n  ...\n}\nwhere index 0 - N corresponds to a rider\n\ngravity:\n{ x: number, y: number }\n\nExample:\nsetCustomGravity([\n  [\n    [[0, 0, 0], {x: 0, y: 0.175}]\n  ], // Give rider 0 normal gravity\n  [\n    [[0, 0, 0], {x: 0, y: 0}],\n    [[0, 1, 0], {x: 0, y: 0.175}],\n  ] // Give rider 1 zero gravity, then enable normal gravity after a second\n])\n";
module.exports = exports.default;