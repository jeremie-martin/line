Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = require("./106.js");
var i = require("./39.js");
var o = require("./7.js");
var a = function (e) {
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
}(require("./27.js"));
var s = require("./113.js");
var l = require("./312.js");
var u = require("./8.js");
function c(e) {
  return e.split("+").map(e => e.trim()).filter(e => e !== "");
}
function d(e) {
  let t = e.slice(0, e.length - 1);
  let n = e[e.length - 1];
  let r = ["cmd", "ctrl", "shift", "alt"];
  t.sort((e, t) => {
    let n = r.indexOf(e);
    let i = r.indexOf(t);
    if (n < 0) {
      n = Number.MAX_SAFE_INTEGER;
    }
    if (i < 0) {
      i = Number.MAX_SAFE_INTEGER;
    }
    if (n === i) {
      if (e < t) {
        return -1;
      } else if (e > t) {
        return 1;
      } else {
        return 0;
      }
    } else {
      return n - i;
    }
  });
  return [...t, n].join("+");
}
const f = {
  "triggers.pencilTool": () => (0, o.setTool)(a.PENCIL_TOOL),
  "triggers.lineTool": () => (0, o.setTool)(a.LINE_TOOL),
  "triggers.eraserTool": () => (0, o.setTool)(a.ERASER_TOOL),
  "triggers.panTool": () => (0, o.setTool)(a.PAN_TOOL),
  "triggers.zoomTool": () => (0, o.setTool)(a.ZOOM_TOOL),
  "triggers.selectTool": () => (0, o.setTool)(a.SELECT_TOOL),
  "triggers.play": () => (0, o.startPlayer)(),
  "triggers.playWithEditorZoom": () => (e, t) => {
    e((0, s.setPlaybackZoomToEditorZoom)());
    e((0, i.triggerCommand)("triggers.play"));
  },
  "triggers.stop": () => (0, o.stopPlayer)(),
  "triggers.flag": () => (0, o.setFlag)(),
  "triggers.playPause": () => (e, t) => {
    if ((0, u.getPlayerRunning)(t())) {
      e((0, i.triggerCommand)("triggers.pause"));
    } else {
      e((0, i.triggerCommand)("triggers.play"));
    }
  },
  "triggers.playWithEditorZoomPause": () => (e, t) => {
    if ((0, u.getPlayerRunning)(t())) {
      e((0, i.triggerCommand)("triggers.pause"));
    } else {
      e((0, s.setPlaybackZoomToEditorZoom)());
      e((0, i.triggerCommand)("triggers.play"));
    }
  },
  "triggers.pause": () => (e, t) => {
    if ((0, u.getPlayerRunning)(t())) {
      e((0, o.setPlayerRunning)(false));
      e((0, s.setEditorCameraToPlaybackCamera)());
    }
  },
  "triggers.toggleSlowMotion": () => (0, o.toggleSlowMotion)(),
  "triggers.removeLastLine": () => (e, t) => {
    let n = (0, u.getSimulatorTrack)(t()).getMaxLineID();
    if (n != null) {
      e((0, o.removeLine)(n));
      e((0, o.commitTrackChanges)());
    }
  },
  "triggers.undo": () => (0, o.undoAction)(),
  "triggers.redo": () => (0, o.redoAction)(),
  "triggers.normalSwatch": () => (0, o.selectLineType)(0),
  "triggers.accelSwatch": () => (0, o.selectLineType)(1),
  "triggers.scenerySwatch": () => (0, o.selectLineType)(2),
  "triggers.nextFrame": () => (0, o.incPlayerIndex)(),
  "triggers.prevFrame": () => (0, o.decPlayerIndex)(),
  "triggers.save": () => (0, l.quicksave)(),
  "triggers.open": () => (0, o.openTrackLoader)(),
  "triggers.goToStart": () => (0, s.setEditorCameraToStart)(),
  "triggers.toggleOnionSkin": () => (e, t) => {
    e((0, o.setOnionSkin)(!t().renderer.onionSkin));
  },
  "triggers.toggleSkeleton": () => (e, t) => {
    e((0, o.setSkeleton)(!t().renderer.skeleton));
  },
  "triggers.showPlaybackCamera": () => (e, t) => {
    const n = t();
    if ((0, u.getPlaybackIsFixedPosition)(n)) {
      const t = (0, u.getEditorCamera)(n);
      e((0, o.setPlaybackPan)(t.position));
      e((0, s.setPlaybackZoomToEditorZoom)());
    } else {
      const t = (0, u.getPlaybackCamera)(n);
      e((0, o.setEditorCamera)(t.position, t.zoom));
    }
  },
  "triggers.togglePlaybackPreview": o.togglePlaybackPreview,
  "triggers.toggleTrackLinesLocked": o.toggleTrackLinesLocked
};
const p = {
  "modifiers.fastForward": {
    begin: () => (0, o.setPlayerFastForward)(true),
    end: () => (0, o.setPlayerFastForward)(false)
  },
  "modifiers.rewind": {
    begin: () => (0, o.setPlayerRewind)(true),
    end: () => (0, o.setPlayerRewind)(false)
  }
};
const h = {
  "triggers.panTool": true,
  "triggers.zoomTool": true,
  "triggers.play": true,
  "triggers.stop": true,
  "triggers.playPause": true,
  "triggers.pause": true,
  "triggers.toggleSlowMotion": true,
  "triggers.nextFrame": true,
  "triggers.prevFrame": true,
  "triggers.goToStart": true,
  "modifiers.fastForward": true,
  "modifiers.rewind": true
};
const m = {
  "triggers.goToStart": true,
  "triggers.play": true,
  "triggers.stop": true,
  "triggers.flag": true,
  "triggers.playPause": true,
  "triggers.pause": true,
  "triggers.toggleSlowMotion": true,
  "triggers.nextFrame": true,
  "triggers.prevFrame": true,
  "triggers.toggleOnionSkin": true,
  "triggers.toggleSkeleton": true,
  "triggers.fastForward": true,
  "triggers.rewind": true,
  "modifiers.fastForward": true,
  "modifiers.rewind": true,
  "triggers.showPlaybackCamera": true
};
function y(e, t) {
  let n = t.getState();
  return !(0, u.getHasOverlay)(n) && ((0, u.getInEditor)(n) || e in h) && (!(0, u.getPlayerRunning)(n) || e in m);
}
exports.default = () => e => t => function (n) {
  const o = t(n);
  const a = e.getState();
  const s = a.command.pressedKeys;
  const l = a.command.hotkeys;
  const u = a.command.activeModifiers;
  switch (n.type) {
    case r.KEY_DOWN:
      {
        const t = n.payload;
        const r = d([...s.remove(t).toArray(), t]);
        const o = Object.keys(l).filter(e => e in l);
        const a = o.filter(e => e.startsWith("triggers."));
        const f = o.filter(e => e.startsWith("modifiers."));
        let p = false;
        for (let n of a) {
          if (d(c(l[n])) === r) {
            e.dispatch((0, i.triggerCommand)(n));
            p = true;
          }
        }
        if (!p) {
          for (let n of a) {
            if (d(c(l[n])) === t) {
              e.dispatch((0, i.triggerCommand)(n));
            }
          }
        }
        for (let n of f) {
          if (!u.has(n)) {
            if (c(l[n]).every(e => s.has(e))) {
              e.dispatch((0, i.beginModifierCommand)(n));
            }
          }
        }
        break;
      }
    case r.KEY_UP:
      for (let t of u) {
        if (!l[t]) {
          continue;
        }
        if (!c(l[t]).every(e => s.has(e))) {
          e.dispatch((0, i.endModifierCommand)(t));
        }
      }
      break;
    case i.TRIGGER_COMMAND:
      (function (e, t) {
        if (y(e, t) && e in f) {
          t.dispatch(f[e]());
        }
      })(n.payload, e);
      break;
    case i.BEGIN_MODIFIER_COMMAND:
      (function (e, t) {
        if (y(e, t) && e in p) {
          t.dispatch(p[e].begin());
        }
      })(n.payload, e);
      break;
    case i.END_MODIFIER_COMMAND:
      (function (e, t) {
        if (y(e, t) && e in p) {
          t.dispatch(p[e].end());
        }
      })(n.payload, e);
  }
  return o;
};
module.exports = exports.default;