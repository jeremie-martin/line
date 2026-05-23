Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getCurrentPlayerRate = exports.getPlayerTime = exports.getPlayerFps = exports.getPlayerSettings = exports.getPlayerFrameRateSetting = exports.getPlayerReversed = exports.getPlayerSlowMotion = exports.getPlayerFlagActive = exports.getPlayerFlagIndex = exports.getPlayerMaxIndex = exports.getPlayerIndex = exports.getPlayerRunning = undefined;
var r = require("./17.js");
const i = exports.getPlayerRunning = e => e.player.running;
const o = exports.getPlayerIndex = e => e.player.index;
exports.getPlayerMaxIndex = e => Math.ceil(e.player.maxIndex);
const a = exports.getPlayerFlagIndex = e => e.player.flagIndex;
exports.getPlayerFlagActive = e => a(e) !== 0;
exports.getPlayerSlowMotion = e => e.player.slowMotion;
exports.getPlayerReversed = e => (e.player.reverse || e.player.rewind) && !e.player.fastForward;
exports.getPlayerFrameRateSetting = e => !e.renderer.skeleton && e.player.settings.interpolate;
exports.getPlayerSettings = e => e.player.settings;
const s = exports.getPlayerFps = e => e.player.settings.fps;
exports.getPlayerTime = (0, r.createSelector)(o, s, (e, t) => e / t);
exports.getCurrentPlayerRate = (0, r.createSelector)(e => e.player.settings.baseRate, e => e.player.settings.slowMotionRate, e => e.player.settings.fastForwardRate, e => e.player.slowMotion, e => e.player.fastForward, e => e.player.rewind, i, (e, t, n, r, i, o, a) => {
  if (r) {
    e *= t;
  }
  if (a && (i || o)) {
    e *= n;
  }
  return e;
});