Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = exports.SET_EDITOR_CAMERA = "SET_EDITOR_CAMERA";
const i = exports.SET_PLAYBACK_ZOOM = "SET_PLAYBACK_ZOOM";
const o = exports.SET_PLAYBACK_PAN = "SET_PLAYBACK_PAN";
const a = exports.TOGGLE_EDITOR_FOLLOWER = "TOGGLE_EDITOR_FOLLOWER";
const s = exports.SET_EDITOR_FOLLOWER_FOCUS = "SET_EDITOR_FOLLOWER_FOCUS";
exports.SET_PLAYBACK_FOLLOWER_SETTINGS = "SET_PLAYBACK_FOLLOWER_SETTINGS";
const l = exports.SET_PLAYBACK_FOLLOWER_FOCUS = "SET_PLAYBACK_FOLLOWER_FOCUS";
const u = exports.SET_PLAYBACK_DIMENSIONS = "SET_PLAYBACK_DIMENSIONS";
exports.setEditorCamera = (e, t) => ({
  type: r,
  payload: {
    position: e,
    zoom: t
  }
});
exports.setEditorFollowerFocus = e => ({
  type: s,
  payload: e
});
exports.setPlaybackZoom = e => ({
  type: i,
  payload: e
});
exports.setPlaybackPan = e => ({
  type: o,
  payload: e
});
exports.setPlaybackFollowerFocus = e => ({
  type: l,
  payload: e
});
exports.toggleEditorFollower = () => ({
  type: a
});
exports.setPlaybackDimensions = e => ({
  type: u,
  payload: e
});