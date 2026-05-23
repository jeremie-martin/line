Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = exports.LOAD_AUDIO = "LOAD_AUDIO";
const i = exports.LOAD_LOCAL_AUDIO = "LOAD_LOCAL_AUDIO";
const o = exports.SET_AUDIO_OFFSET = "SET_AUDIO_OFFSET";
const a = exports.TOGGLE_AUDIO = "TOGGLE_AUDIO";
const s = exports.LOAD_AUDIO_PENDING = "LOAD_AUDIO_PENDING";
const l = exports.LOAD_AUDIO_FAIL = "LOAD_AUDIO_FAIL";
const u = exports.SET_AUDIO_VOLUME = "SET_AUDIO_VOLUME";
const c = exports.REMOVE_AUDIO = "REMOVE_AUDIO";
exports.audioLoadFail = e => ({
  type: l,
  payload: e,
  error: true
});
exports.loadAudioPending = () => ({
  type: s
});
exports.toggleAudio = () => ({
  type: a
});
exports.removeAudio = () => ({
  type: c
});
exports.setAudioOffset = e => ({
  type: o,
  payload: e
});
exports.loadAudio = (e, t) => ({
  type: r,
  payload: {
    name: e,
    arraybuffer: t
  }
});
exports.loadLocalAudioAction = (e, t) => ({
  type: i,
  payload: {
    path: e,
    name: t
  }
});
exports.setAudioVolume = e => ({
  type: u,
  payload: e
});