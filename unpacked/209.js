Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = exports.TRIGGER_HINT = "TRIGGER_HINT";
const i = exports.SHOW_HINT = "SHOW_HINT";
exports.triggerHint = (e, t = null) => ({
  type: r,
  payload: {
    hint: e,
    tooltip: t
  }
});
exports.showHint = () => ({
  type: i
});