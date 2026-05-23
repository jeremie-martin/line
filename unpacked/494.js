Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = exports.REGISTER_CUSTOM_SETTING = "REGISTER_CUSTOM_SETTING";
const i = exports.REGISTER_CUSTOM_TOOL = "REGISTER_CUSTOM_TOOL";
const o = exports.TOGGLE_CUSTOM_SETTING = "TOGGLE_CUSTOM_SETTING";
exports.registerModSetting = e => ({
  type: r,
  payload: e
});
exports.registerModTool = (e, t, n, r) => ({
  type: i,
  payload: {
    toolName: e,
    tool: t,
    component: n,
    icon: r
  }
});
exports.toggleCustomSetting = e => ({
  type: o,
  payload: e
});