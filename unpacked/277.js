Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = exports.SET_TOOL_STATE = "SET_TOOL_STATE";
const i = exports.SET_TOOL = "SET_TOOL";
const o = exports.UPDATE_LINES = "UPDATE_LINES";
const a = exports.SELECT_LINE_TYPE = "SELECT_LINE_TYPE";
const s = exports.SELECT_SCENERY_WIDTH = "SELECT_SCENERY_WIDTH";
const l = exports.UNDO = "UNDO";
const u = exports.REDO = "REDO";
exports.REMOVE_LAST_LINE = "REMOVE_LAST_LINE";
const c = exports.COMMIT_TRACK_CHANGES = "COMMIT_TRACK_CHANGES";
const d = exports.REVERT_TRACK_CHANGES = "REVERT_TRACK_CHANGES";
exports.SELECT_LINE = "SELECT_LINE";
const f = exports.TOGGLE_TRACK_LINES_LOCKED = "TOGGLE_TRACK_LINES_LOCKED";
const p = exports.TOGGLE_NEXT_FRAME_LIFELOCK = "TOGGLE_NEXT_FRAME_LIFELOCK";
const h = exports.ADD_LAYER = "ADD_LAYER";
const m = exports.REMOVE_LAYER = "REMOVE_LAYER";
const y = exports.MOVE_LAYER = "MOVE_LAYER";
const g = exports.COPY_LAYER = "COPY_LAYER";
const v = exports.RENAME_LAYER = "RENAME_LAYER";
const b = exports.SET_LAYER_ACTIVE = "SET_LAYER_ACTIVE";
const _ = exports.SET_LAYER_VISIBLE = "SET_LAYER_VISIBLE";
const w = exports.SET_LAYER_EDITABLE = "SET_LAYER_EDITABLE";
const x = exports.ADD_FOLDER = "ADD_FOLDER";
const E = exports.REMOVE_FOLDER = "REMOVE_FOLDER";
const S = exports.MOVE_FOLDER = "MOVE_FOLDER";
const T = exports.RENAME_FOLDER = "RENAME_FOLDER";
const k = exports.SET_FOLDER_VISIBLE = "SET_FOLDER_VISIBLE";
const O = exports.SET_FOLDER_EDITABLE = "SET_FOLDER_EDITABLE";
const P = exports.COLLAPSE_FOLDER = "COLLAPSE_FOLDER";
const C = exports.EXPAND_FOLDER = "EXPAND_FOLDER";
const I = exports.SET_RIDERS = "SET_RIDERS";
exports.toggleTrackLinesLocked = () => ({
  type: f
});
exports.toggleNextFrameLifelock = () => ({
  type: p
});
exports.selectLineType = e => ({
  type: a,
  payload: e
});
exports.selectSceneryWidth = e => ({
  type: s,
  payload: e
});
exports.setTool = e => ({
  type: i,
  payload: e
});
exports.setToolState = (e, t) => ({
  type: r,
  payload: t,
  meta: {
    id: e
  }
});
const M = exports.updateLines = (e, t, n, r = false) => ({
  type: o,
  payload: {
    linesToRemove: t,
    linesToAdd: n,
    initialLoad: r
  },
  meta: {
    name: e
  }
});
exports.addLine = e => M("ADD_LINE", null, [e]);
exports.loadLines = e => M("LOAD_LINES", null, e, true);
exports.addLines = e => M("ADD_LINES", null, e);
exports.duplicateLines = e => M("DUPLICATE_LINES", null, e);
exports.removeLine = e => M("REMOVE_LINE", [e], null);
exports.removeLines = e => M("REMOVE_LINES", e, null);
exports.setLines = e => M("SET_LINES", null, e);
exports.replaceLine = (e, t) => M("REPLACE_LINE", [e], [t]);
exports.undoAction = () => ({
  type: l
});
exports.redoAction = () => ({
  type: u
});
exports.commitTrackChanges = () => ({
  type: c
});
exports.revertTrackChanges = () => ({
  type: d,
  meta: {
    ignorable: true
  }
});
exports.addLayer = (e = "") => ({
  type: h,
  payload: {
    name: e
  }
});
exports.removeLayer = e => ({
  type: m,
  payload: {
    id: e
  }
});
exports.moveLayer = (e, t) => ({
  type: y,
  payload: {
    id: e,
    index: t
  }
});
exports.copyLayer = e => ({
  type: g,
  payload: {
    id: e
  }
});
exports.renameLayer = (e, t) => ({
  type: v,
  payload: {
    id: e,
    name: t
  }
});
exports.setLayerActive = e => ({
  type: b,
  payload: {
    id: e
  }
});
exports.setLayerVisible = (e, t) => ({
  type: _,
  payload: {
    id: e,
    visible: t
  }
});
exports.setLayerEditable = (e, t) => ({
  type: w,
  payload: {
    id: e,
    editable: t
  }
});
exports.addFolder = (e = "") => ({
  type: x,
  payload: {
    name: e
  }
});
exports.removeFolder = e => ({
  type: E,
  payload: {
    id: e
  }
});
exports.moveFolder = (e, t) => ({
  type: S,
  payload: {
    id: e,
    index: t
  }
});
exports.renameFolder = (e, t) => ({
  type: T,
  payload: {
    id: e,
    name: t
  }
});
exports.setFolderVisible = (e, t) => ({
  type: k,
  payload: {
    id: e,
    visible: t
  }
});
exports.setFolderEditable = (e, t) => ({
  type: O,
  payload: {
    id: e,
    editable: t
  }
});
exports.setRiders = e => ({
  type: I,
  payload: e
});
exports.expandFolder = e => ({
  type: C,
  payload: e
});
exports.collapseFolder = e => ({
  type: P,
  payload: e
});