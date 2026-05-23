Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.togglePlaybackFollowerFocus = exports.setPlaybackZoomToEditorZoom = exports.setEditorCameraToPlaybackCamera = exports.setEditorCameraToStart = undefined;
var r = require("./8.js");
var i = require("./7.js");
exports.setEditorCameraToStart = () => function (e, t) {
  const n = (0, r.getEditorFollowerFocus)(t());
  const o = (0, r.getRiders)(t())[n].startPosition;
  e((0, i.setEditorCamera)(o, 2));
  e((0, i.setPlaybackPan)(o));
  e((0, i.setPlaybackZoom)(2));
};
exports.setEditorCameraToPlaybackCamera = () => function (e, t) {
  var n = (0, r.getPlaybackCamera)(t());
  let o = n.position;
  let a = n.zoom;
  e((0, i.setEditorCamera)(o, a));
};
exports.setPlaybackZoomToEditorZoom = () => function (e, t) {
  let n = (0, r.getEditorZoom)(t());
  e((0, i.setPlaybackZoom)(n));
};
exports.togglePlaybackFollowerFocus = e => function (t, n) {
  let o = [...(0, r.getPlaybackCameraFocus)(n())];
  o[e] = !o[e];
  t((0, i.setPlaybackFollowerFocus)(o));
};