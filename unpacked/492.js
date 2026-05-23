Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = exports.NEW_TRACK = "NEW_TRACK";
const i = exports.LOAD_TRACK = "LOAD_TRACK";
const o = exports.SAVE_TRACK = "SAVE_TRACK";
exports.newTrack = (e = false) => ({
  type: r,
  payload: {
    startPosition: {
      x: 0,
      y: 0
    },
    version: e ? "6.1" : "6.2",
    label: "",
    creator: "",
    description: "",
    dirty: false,
    saveTime: null,
    viewOnly: false,
    derivedFrom: null
  }
});
exports.loadTrackAction = e => ({
  type: i,
  payload: Object.assign({
    viewOnly: e["for viewing only, please don't steal tracks"] === true
  }, e)
});
exports.saveTrackAction = () => ({
  type: o
});