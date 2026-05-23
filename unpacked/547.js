Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.command = function (e = u, {
  type: t,
  payload: n
}) {
  switch (t) {
    case s.SET_COMMAND_HOTKEYS:
      return Object.assign({}, e, {
        hotkeys: Object.assign({}, e.hotkeys, n)
      });
    case s.INIT_COMMAND_HOTKEYS:
      let r = {};
      for (const t of Object.keys(n)) {
        if (Object.keys(e.tags).includes(t) && !e.tags[t].readonly) {
          r[t] = n[t];
        }
      }
      return Object.assign({}, e, {
        hotkeys: Object.assign({}, e.hotkeys, r)
      });
    case a.KEY_DOWN:
      return Object.assign({}, e, {
        pressedKeys: e.pressedKeys.add(n)
      });
    case a.KEY_UP:
      return Object.assign({}, e, {
        pressedKeys: e.pressedKeys.remove(n)
      });
    case s.BEGIN_MODIFIER_COMMAND:
      return Object.assign({}, e, {
        activeModifiers: e.activeModifiers.add(n)
      });
    case s.END_MODIFIER_COMMAND:
      return Object.assign({}, e, {
        activeModifiers: e.activeModifiers.remove(n)
      });
    case s.TOGGLE_MODIFIER_COMMAND:
      return Object.assign({}, e, {
        activeModifiers: e.activeModifiers.has(n) ? e.activeModifiers.remove(n) : e.activeModifiers.add(n)
      });
    case s.REPLACE_CTRL_KEY:
      return Object.assign({}, e, {
        hotkeys: l(e.hotkeys, n)
      });
    case s.TRIGGER_COMMAND:
      let i = e.triggerCounts.get(n, 0);
      return Object.assign({}, e, {
        triggerCounts: e.triggerCounts.set(n, i + 1)
      });
    case s.RESTORE_DEFAULT_HOTKEYS:
      return Object.assign({}, e, {
        hotkeys: /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? l(u.hotkeys, "cmd") : Object.assign({}, u.hotkeys)
      });
    default:
      return e;
  }
};
var r;
var i = require("./548.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
var a = require("./106.js");
var s = require("./39.js");
function l(e, t) {
  let n = {};
  for (let r of Object.keys(e)) {
    let i = e[r];
    n[r] = i.replace("ctrl", t);
  }
  return n;
}
const u = {
  pressedKeys: o.default.Set(),
  hotkeys: {
    "triggers.pencilTool": "q",
    "triggers.lineTool": "w",
    "triggers.eraserTool": "e",
    "triggers.selectTool": "s",
    "triggers.panTool": "r",
    "triggers.zoomTool": "t",
    "triggers.play": "y",
    "triggers.playWithEditorZoom": "shift+y",
    "triggers.stop": "u",
    "triggers.flag": "i",
    "triggers.playPause": "space",
    "triggers.playWithEditorZoomPause": "shift+space",
    "triggers.toggleSlowMotion": "m",
    "triggers.removeLastLine": "backspace",
    "triggers.undo": "ctrl+z",
    "triggers.redo": "ctrl+shift+z",
    "triggers.normalSwatch": "1",
    "triggers.accelSwatch": "2",
    "triggers.scenerySwatch": "3",
    "triggers.nextFrame": "right",
    "triggers.prevFrame": "left",
    "triggers.save": "ctrl+s",
    "triggers.open": "ctrl+o",
    "triggers.goToStart": "h",
    "triggers.toggleOnionSkin": "o",
    "triggers.toggleSkeleton": "p",
    "triggers.showPlaybackCamera": "n",
    "triggers.togglePlaybackPreview": "ctrl+p",
    "triggers.select.cut": "ctrl+x",
    "triggers.select.copy": "ctrl+c",
    "triggers.select.paste": "ctrl+v",
    "triggers.select.flatPaste": "ctrl+shift+v",
    "triggers.select.duplicate": "ctrl+d",
    "triggers.select.deselect": "escape",
    "triggers.select.clipboard.copy": "alt+c",
    "triggers.select.clipboard.paste": "alt+v",
    "modifiers.angleSnap": "ctrl",
    "modifiers.disablePointSnap": "alt",
    "modifiers.flipLine": "shift",
    "modifiers.forceZoom": "ctrl",
    "modifiers.showPlaybackCamera": "n",
    "modifiers.lockEditorCamera": "shift",
    "modifiers.angleLock": "a",
    "modifiers.perpAngleLock": "shift+a",
    "modifiers.select.add": "shift",
    "modifiers.select.subtract": "ctrl",
    "modifiers.select.singlePoint": "alt",
    "modifiers.select.duplicate": "d",
    "modifiers.select.fineNudge": "shift",
    "modifiers.select.lifelock": "l",
    "modifiers.select.transformState": "alt",
    "triggers.select.convertToNormal": "1",
    "triggers.select.convertToAccel": "2",
    "triggers.select.convertToScenery": "3",
    "triggers.select.reverseLine": "r",
    "triggers.select.flipLine": "f",
    "triggers.select.moveUp": "w",
    "triggers.select.moveLeft": "a",
    "triggers.select.moveDown": "s",
    "triggers.select.moveRight": "d",
    "modifiers.fastForward": ".",
    "modifiers.rewind": ","
  },
  activeModifiers: o.default.Set(),
  triggerCounts: o.default.Map(),
  tags: {
    "triggers.pencilTool": {},
    "triggers.lineTool": {},
    "triggers.eraserTool": {},
    "triggers.selectTool": {},
    "triggers.panTool": {},
    "triggers.zoomTool": {},
    "triggers.play": {
      complement: "triggers.playWithEditorZoom"
    },
    "triggers.playWithEditorZoom": {
      modifiers: ["shift"],
      readonly: true
    },
    "triggers.stop": {},
    "triggers.flag": {},
    "triggers.playPause": {
      readonly: true
    },
    "triggers.playWithEditorZoomPause": {
      readonly: true
    },
    "triggers.toggleSlowMotion": {},
    "triggers.removeLastLine": {
      readonly: true
    },
    "triggers.undo": {
      readonly: true
    },
    "triggers.redo": {
      readonly: true
    },
    "triggers.normalSwatch": {
      readonly: true
    },
    "triggers.accelSwatch": {
      readonly: true
    },
    "triggers.scenerySwatch": {
      readonly: true
    },
    "triggers.nextFrame": {
      readonly: true
    },
    "triggers.prevFrame": {
      readonly: true
    },
    "triggers.save": {
      readonly: true
    },
    "triggers.open": {
      readonly: true
    },
    "triggers.goToStart": {},
    "triggers.toggleOnionSkin": {},
    "triggers.toggleSkeleton": {},
    "triggers.showPlaybackCamera": {
      complement: "modifiers.showPlaybackCamera"
    },
    "modifiers.showPlaybackCamera": {
      readonly: true,
      hidden: true
    },
    "triggers.togglePlaybackPreview": {
      readonly: true
    },
    "triggers.select.cut": {
      readonly: true
    },
    "triggers.select.copy": {
      readonly: true
    },
    "triggers.select.paste": {
      readonly: true
    },
    "triggers.select.flatPaste": {
      readonly: true
    },
    "triggers.select.duplicate": {
      readonly: true
    },
    "triggers.select.deselect": {
      readonly: true
    },
    "triggers.select.clipboard.copy": {
      readonly: true
    },
    "triggers.select.clipboard.paste": {
      readonly: true
    },
    "modifiers.angleSnap": {},
    "modifiers.disablePointSnap": {},
    "modifiers.flipLine": {
      readonly: true
    },
    "modifiers.forceZoom": {
      readonly: true
    },
    "modifiers.lockEditorCamera": {
      readonly: true
    },
    "modifiers.angleLock": {
      complement: "modifiers.perpAngleLock"
    },
    "modifiers.perpAngleLock": {
      modifiers: ["shift"],
      readonly: true
    },
    "modifiers.select.add": {
      readonly: true
    },
    "modifiers.select.subtract": {
      readonly: true
    },
    "modifiers.select.singlePoint": {
      readonly: true
    },
    "modifiers.fastForward": {
      readonly: true
    },
    "modifiers.rewind": {
      readonly: true
    },
    "modifiers.select.duplicate": {
      readonly: true
    },
    "modifiers.select.lifelock": {},
    "modifiers.select.transformState": {
      readonly: true,
      hidden: true
    },
    "triggers.select.convertToNormal": {
      joins: ["modifiers.select.transformState"],
      readonly: true
    },
    "triggers.select.convertToAccel": {
      joins: ["modifiers.select.transformState"],
      readonly: true
    },
    "triggers.select.convertToScenery": {
      joins: ["modifiers.select.transformState"],
      readonly: true
    },
    "triggers.select.reverseLine": {
      joins: ["modifiers.select.transformState"],
      readonly: true
    },
    "triggers.select.flipLine": {
      joins: ["modifiers.select.transformState"],
      readonly: true
    },
    "modifiers.select.fineNudge": {
      readonly: true,
      hidden: true
    },
    "triggers.select.moveUp": {
      joins: ["modifiers.select.transformState"],
      readonly: true
    },
    "triggers.select.moveLeft": {
      joins: ["modifiers.select.transformState"],
      readonly: true
    },
    "triggers.select.moveDown": {
      joins: ["modifiers.select.transformState"],
      readonly: true
    },
    "triggers.select.moveRight": {
      joins: ["modifiers.select.transformState"],
      readonly: true
    }
  }
};