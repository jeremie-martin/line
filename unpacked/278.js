Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = exports.SET_PLAYER_FPS = "SET_PLAYER_FPS";
const i = exports.TOGGLE_INTERPOLATE = "TOGGLE_INTERPOLATE";
const o = exports.SET_INTERPOLATE = "SET_INTERPOLATE";
const a = exports.TOGGLE_SLOW_MOTION = "TOGGLE_SLOW_MOTION";
const s = exports.SET_PLAYER_INDEX = "SET_PLAYER_INDEX";
const l = exports.SET_PLAYER_MAX_INDEX = "SET_PLAYER_MAX_INDEX";
const u = exports.INC_PLAYER_INDEX = "INC_PLAYER_INDEX";
const c = exports.DEC_PLAYER_INDEX = "DEC_PLAYER_INDEX";
const d = exports.START_PLAYER = "START_PLAYER";
const f = exports.STOP_PLAYER = "STOP_PLAYER";
const p = exports.SET_FLAG_INDEX = "SET_FLAG_INDEX";
const h = exports.SET_FLAG = "SET_FLAG";
const m = exports.SET_PLAYER_RUNNING = "SET_PLAYER_RUNNING";
const y = exports.SET_PLAYER_SCRUBBING = "SET_PLAYER_SCRUBBING";
const g = exports.SET_PLAYER_FAST_FORWARD = "SET_PLAYER_FAST_FORWARD";
const v = exports.SET_PLAYER_REWIND = "SET_PLAYER_REWIND";
const b = exports.SET_PLAYER_STOP_AT_END = "SET_PLAYER_STOP_AT_END";
const _ = exports.SET_PLAYER_SETTINGS = "SET_PLAYER_SETTINGS";
exports.setPlayerFps = e => ({
  type: r,
  payload: e
});
exports.toggleInterpolate = () => ({
  type: i
});
exports.setInterpolate = e => ({
  type: o,
  payload: e
});
exports.toggleSlowMotion = () => ({
  type: a
});
exports.incPlayerIndex = () => ({
  type: u
});
exports.decPlayerIndex = () => ({
  type: c
});
exports.startPlayer = () => ({
  type: d
});
exports.stopPlayer = () => ({
  type: f
});
exports.setFlag = () => ({
  type: h
});
exports.setFrameIndex = e => ({
  type: s,
  payload: e
});
exports.setPlayerMaxIndex = e => ({
  type: l,
  payload: e
});
exports.setFlagIndex = e => ({
  type: p,
  payload: e
});
exports.setPlayerRunning = e => ({
  type: m,
  payload: e
});
exports.setPlayerScrubbing = e => ({
  type: y,
  payload: e
});
exports.setPlayerFastForward = e => ({
  type: g,
  payload: e
});
exports.setPlayerRewind = e => ({
  type: v,
  payload: e
});
exports.setPlayerStopAtEnd = e => ({
  type: b,
  payload: e
});
exports.setPlayerSettings = e => ({
  type: _,
  payload: e
});