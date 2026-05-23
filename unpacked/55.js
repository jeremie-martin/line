Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = "trackData/";
const i = exports.SET_TRACK_DETAILS = r + "SET_TRACK_DETAILS";
const o = exports.SET_CLOUD_INFO = r + "SET_CLOUD_INFO";
const a = exports.SET_LOCAL_FILE = r + "SET_LOCAL_FILE";
const s = exports.SET_TRACK_SCRIPT = r + "SET_TRACK_SCRIPT";
exports.setCloudInfo = e => ({
  type: o,
  payload: e
});
exports.setTrackDetails = (e, t, n, r = null, o = null) => ({
  type: i,
  payload: {
    title: e,
    creator: t,
    description: n,
    cloudInfo: r,
    derivedFrom: o
  }
});
exports.setLocalFile = e => ({
  type: a,
  payload: e
});
exports.setTrackScript = e => ({
  type: s,
  payload: e
});