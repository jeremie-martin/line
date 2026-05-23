Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getViewOptions = exports.getColorPlayback = exports.getPlaybackPreview = exports.getOnionSkinActive = exports.getOnionEndIndex = exports.getOnionBeginIndex = exports.getSpriteSheet = exports.getMillionsEnabled = exports.getRendererScenes = exports.getPixelRatio = undefined;
var r = require("./17.js");
var i = require("./140.js");
var o = require("./281.js");
var a = require("./141.js");
exports.getPixelRatio = e => e.renderer.pixelRatio;
exports.getRendererScenes = (0, r.createStructuredSelector)({
  customEditScene: e => e.renderer.edit,
  customPlaybackScene: e => e.renderer.playback
});
exports.getMillionsEnabled = e => e.renderer.millionsEnabled;
exports.getSpriteSheet = (0, r.createSelector)(a.getNumRiders, e => e.renderer.spriteSheets, (e, t) => {
  if (!t) {
    return null;
  }
  if (e === 1) {
    return [t[0]];
  }
  {
    let n = [];
    for (let r = 0; r < e; r++) {
      let e = (r + 1) % t.length;
      n.push(t[e]);
    }
    return n;
  }
});
exports.getOnionBeginIndex = e => Math.max(0, Math.ceil(e.player.index) - e.renderer.onionSkinFramesBefore);
exports.getOnionEndIndex = e => Math.min(e.player.maxIndex, Math.max(0, Math.floor(e.player.index) + e.renderer.onionSkinFramesAfter));
exports.getOnionSkinActive = e => e.renderer.onionSkin;
const s = exports.getPlaybackPreview = e => e.renderer.playbackPreview;
const l = exports.getColorPlayback = e => e.renderer.colorPlayback;
exports.getViewOptions = (0, r.createStructuredSelector)({
  color: e => (0, i.getPlayerRunning)(e) ? l(e) : !s(e),
  flag: e => e.renderer.flag ?? (!(0, o.getInViewer)(e) || !(0, i.getPlayerRunning)(e)),
  skeleton: e => e.renderer.skeleton
});