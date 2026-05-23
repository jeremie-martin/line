Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getProgress = exports.getAutosaveProgress = exports.getTrackLoaderProgress = exports.getTrackSaverInProgress = exports.getTrackSaverProgress = undefined;
var r = require("./7.js");
exports.getTrackSaverProgress = e => e.progress[r.SAVE_TRACK];
exports.getTrackSaverInProgress = e => e.progress[r.SAVE_TRACK].percent != null;
exports.getTrackLoaderProgress = e => e.progress[r.LOAD_TRACK];
exports.getAutosaveProgress = e => e.progress[r.AUTOSAVE];
exports.getProgress = (e, t) => {
  let n = e.progress[t];
  if (!n) {
    throw new Error("unknown progressId:", t);
  }
  return n;
};