Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getPlaybackCameraAtIndex = exports.getCurrentCamera = exports.getPlaybackCameraFocus = exports.getPlaybackCamera = exports.getPlaybackCameraParams = exports.getPlaybackDimensions = exports.hasPlaybackDimensions = exports.getPlaybackIsFixedPosition = exports.getPlaybackFixedPosition = exports.getPlaybackZoom = exports.getEditorFollowerFocus = exports.getEditorDimensions = exports.getUseEditorFollower = exports.getEditorCamera = exports.getEditorPosition = exports.getEditorZoom = undefined;
var r = require("./140.js");
var i = require("./141.js");
var o = require("./17.js");
const a = exports.getEditorZoom = e => e.camera.editorZoom;
exports.getEditorPosition = e => e.camera.editorPosition;
const s = exports.getEditorCamera = (0, o.createSelector)(e => e.camera.editorPosition, a, (e, t) => ({
  position: e,
  zoom: t
}));
exports.getUseEditorFollower = e => e.settings["cam.useEditorFollower"];
const l = exports.getEditorDimensions = e => e.camera.editorDimensions;
exports.getEditorFollowerFocus = e => Math.min((0, i.getNumRiders)(e) - 1, e.camera.editorFollowerFocus);
const u = exports.getPlaybackZoom = e => window.getAutoZoom ? window.getAutoZoom((0, r.getPlayerIndex)(e)) : e.camera.playbackZoom;
const c = exports.getPlaybackFixedPosition = e => e.camera.playbackFixedPosition;
exports.getPlaybackIsFixedPosition = e => e.camera.playbackFollower.isFixed();
exports.hasPlaybackDimensions = e => e.camera.playbackDimensions != null;
const d = exports.getPlaybackDimensions = e => e.camera.playbackDimensions || l(e);
const f = exports.getPlaybackCameraParams = (0, o.createSelector)(u, d, (e, {
  width: t,
  height: n
}) => ({
  zoom: e,
  width: t,
  height: n
}));
const p = exports.getPlaybackCamera = (0, o.createSelector)(e => e.camera.playbackFollower, i.getSimulatorTrack, r.getPlayerIndex, u, f, c, (e, t, n, r, i, o) => ({
  position: e.isFixed() ? o : e.getCamera(t, i, n),
  zoom: r
}));
exports.getPlaybackCameraFocus = e => e.camera.playbackFollower.focus;
exports.getCurrentCamera = e => (0, r.getPlayerRunning)(e) ? p(e) : s(e);
exports.getPlaybackCameraAtIndex = (e, t) => ({
  position: e.camera.playbackFollower.isFixed() ? c(e) : e.camera.playbackFollower.getCamera((0, i.getSimulatorTrack)(e), f(e), t),
  zoom: u(e)
});