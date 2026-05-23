Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = exports.ANALYTICS_SAVE_TRACK = "ANALYTICS_SAVE_TRACK";
const i = exports.ANALYTICS_SAVE_TRACK_FILE = "ANALYTICS_SAVE_TRACK_FILE";
const o = exports.ANALYTICS_LOAD_TRACK = "ANALYTICS_LOAD_TRACK";
const a = exports.ANALYTICS_LOAD_TRACK_FILE = "ANALYTICS_LOAD_TRACK_FILE";
const s = exports.ANALYTICS_COPY_LINK = "ANALYTICS_COPY_LINK";
exports.analyticsSaveTrack = () => ({
  type: r
});
exports.analyticsSaveTrackFile = () => ({
  type: i
});
exports.analyticsLoadTrack = () => ({
  type: o
});
exports.analyticsLoadTrackFile = () => ({
  type: a
});
exports.analyticsCopyLink = e => ({
  type: s,
  payload: e
});