Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = exports.LOAD_SAVED_TRACKS = "LOAD_SAVED_TRACKS";
const i = exports.PUT_SAVED_TRACK = "PUT_SAVED_TRACK";
const o = exports.REMOVE_SAVED_TRACK = "REMOVE_SAVED_TRACK";
const a = exports.SET_AUTOSAVE_ENABLED = "SET_AUTOSAVE_ENABLED";
exports.setAutosaveEnabled = e => ({
  type: a,
  payload: e
});
exports.loadSavedTracks = e => ({
  type: r,
  payload: e
});
exports.putSavedTrack = e => ({
  type: i,
  payload: e
});
exports.removeSavedTrack = e => ({
  type: o,
  payload: e
});