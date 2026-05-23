Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = exports.RESIZE = "RESIZE";
const i = exports.EDIT_COPY = "EDIT_COPY";
const o = exports.SET_CONTROLS_ACTIVE = "SET_CONTROLS_ACTIVE";
const a = exports.TOGGLE_CONTROLS_ACTIVE = "TOGGLE_CONTROLS_ACTIVE";
const s = exports.PING = "PING";
const l = exports.LOAD_SETTINGS = "LOAD_SETTINGS";
const u = exports.SET_SETTING = "SET_SETTING";
const c = exports.TOGGLE_SETTING = "TOGGLE_SETTING";
exports.resize = ({
  width: e,
  height: t
}) => ({
  type: r,
  payload: {
    width: e,
    height: t
  }
});
exports.setControlsActive = e => ({
  type: o,
  payload: e
});
exports.toggleControlsActive = () => ({
  type: a
});
exports.ping = e => ({
  type: s,
  payload: e
});
exports.editCopy = () => ({
  type: i
});
exports.loadSettings = e => ({
  type: l,
  payload: e
});
exports.setSetting = (e, t) => ({
  type: u,
  payload: {
    key: e,
    value: t
  }
});
exports.toggleSetting = e => ({
  type: c,
  payload: {
    key: e
  }
});