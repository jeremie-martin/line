Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AUTOSAVE = "AUTOSAVE";
const r = exports.CLEAR_AUTOSAVE = "CLEAR_AUTOSAVE";
const i = exports.LOAD_AUTOSAVE = "LOAD_AUTOSAVE";
exports.clearAutosave = () => ({
  type: r
});
exports.loadAutosave = () => ({
  type: i
});