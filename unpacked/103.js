Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = exports.SET_VIEW_OPTION = "SET_VIEW_OPTION";
const i = exports.SET_PIXEL_RATIO = "SET_PIXEL_RATIO";
const o = exports.SET_RENDERER_SCENE = "SET_RENDERER_SCENE";
const a = exports.SET_MILLIONS = "SET_MILLIONS";
const s = exports.SET_SPRITE_SHEETS = "SET_SPRITE_SHEETS";
const l = exports.SET_ONION_SKIN = "SET_ONION_SKIN";
const u = exports.SET_SKELETON = "SET_SKELETON";
const c = exports.SET_ONION_SKIN_FRAMES_BEFORE = "SET_ONION_SKIN_FRAMES_BEFORE";
const d = exports.SET_ONION_SKIN_FRAMES_AFTER = "SET_ONION_SKIN_FRAMES_AFTER";
const f = exports.setViewOption = (e, t) => ({
  type: r,
  payload: {
    key: e,
    value: t
  }
});
exports.setRendererFlag = e => f("flag", e);
exports.toggleColorPlayback = () => f("colorPlayback", null);
exports.togglePlaybackPreview = () => f("playbackPreview", null);
exports.setPixelRatio = e => ({
  type: i,
  payload: e
});
exports.setRendererScene = (e, t) => ({
  type: o,
  payload: {
    key: e,
    scene: t
  }
});
exports.enableMillions = () => ({
  type: a,
  payload: true
});
exports.disableMillions = () => ({
  type: a,
  payload: false
});
exports.setSpriteSheets = e => ({
  type: s,
  payload: e
});
exports.setOnionSkin = e => ({
  type: l,
  payload: e
});
exports.setSkeleton = e => ({
  type: u,
  payload: e
});
exports.setOnionSkinFramesBefore = e => ({
  type: c,
  payload: e
});
exports.setOnionSkinFramesAfter = e => ({
  type: d,
  payload: e
});