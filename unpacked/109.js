Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.setAutosaveProgressDone = exports.setAutosaveProgress = exports.setTrackLoaderProgressFail = exports.setTrackLoaderProgressDone = exports.setTrackLoaderProgress = exports.setTrackSaverProgressFail = exports.setTrackSaverProgressDone = exports.setTrackSaverProgress = exports.PROGRESS_DONE = exports.PROGRESS = undefined;
var r = require("./7.js");
const i = exports.PROGRESS = "PROGRESS";
const o = exports.PROGRESS_DONE = "PROGRESS_DONE";
exports.setTrackSaverProgress = (e, t) => ({
  type: i,
  meta: {
    id: r.SAVE_TRACK
  },
  payload: {
    status: e,
    percent: t
  }
});
exports.setTrackSaverProgressDone = e => ({
  type: o,
  meta: {
    id: r.SAVE_TRACK
  }
});
exports.setTrackSaverProgressFail = e => ({
  type: o,
  meta: {
    id: r.SAVE_TRACK
  },
  payload: e,
  error: !!e
});
exports.setTrackLoaderProgress = (e, t) => ({
  type: i,
  meta: {
    id: r.LOAD_TRACK
  },
  payload: {
    status: e,
    percent: t
  }
});
exports.setTrackLoaderProgressDone = e => ({
  type: o,
  meta: {
    id: r.LOAD_TRACK
  }
});
exports.setTrackLoaderProgressFail = e => ({
  type: o,
  meta: {
    id: r.LOAD_TRACK
  },
  payload: e,
  error: !!e
});
exports.setAutosaveProgress = (e, t) => ({
  type: i,
  meta: {
    id: r.AUTOSAVE
  },
  payload: {
    status: e,
    percent: t
  }
});
exports.setAutosaveProgressDone = e => ({
  type: o,
  meta: {
    id: r.AUTOSAVE
  }
});