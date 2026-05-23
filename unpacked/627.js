Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = require("./8.js");
var i = require("./7.js");
var o = require("./35.js");
var a = c(require("./628.js"));
var s = c(require("./16.js"));
var l = require("./113.js");
var u = require("./27.js");
require("./39.js");
function c(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = () => e => {
  let t = 0;
  return n => function (c) {
    if (c.type === i.SET_TOOL && c.payload === u.PAN_TOOL) {
      const n = Date.now();
      if (n - t < 300) {
        const t = e.getState();
        const n = (0, r.getEditorFollowerFocus)(t);
        const o = (0, r.getSimulatorTrack)(t);
        const a = (0, r.getPlayerIndex)(t);
        const s = o.getRider(a, n).position;
        e.dispatch((0, i.setEditorCamera)(s, 2));
      }
      t = n;
    }
    const d = e.getState();
    const f = n(c);
    const p = e.getState();
    if (p.player.stopAtEnd && (0, r.getPlayerRunning)(d) && !(0, r.getPlayerRunning)(p)) {
      e.dispatch((0, l.setEditorCameraToPlaybackCamera)());
      return f;
    }
    if ((0, r.getPlayerRunning)(d) || (0, r.getPlayerIndex)(d) === (0, r.getPlayerIndex)(p)) {
      return f;
    }
    if ((0, o.getModifier)(p, "modifiers.showPlaybackCamera")) {
      const t = (0, r.getPlaybackCamera)(p);
      e.dispatch((0, i.setEditorCamera)(t.position, t.zoom));
      return f;
    }
    if ((0, o.getModifier)(p, "modifiers.lockEditorCamera")) {
      return f;
    }
    if ((0, r.getUseEditorFollower)(p)) {
      let t = (0, r.getEditorCamera)(p);
      let n = (0, r.getEditorDimensions)(p);
      const o = (0, r.getEditorFollowerFocus)(p);
      const l = (0, r.getSimulatorTrack)(p);
      const u = (0, r.getPlayerIndex)(p);
      const c = l.getRider(u, o).position;
      let d = (0, a.default)(new s.default(t.position), new s.default(c), n.width, n.height, t.zoom);
      if (!d.equals(t.position)) {
        e.dispatch((0, i.setEditorCamera)(d, t.zoom));
      }
    }
    return f;
  };
};
module.exports = exports.default;