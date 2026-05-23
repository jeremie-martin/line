Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getNextFrameLifelock = exports.getToolSceneLayer = exports.getCursor = exports.getSelectedSceneryWidth = exports.getSelectedLineType = exports.getTrackLinesLocked = exports.getLineTypePickerActive = exports.colorPickerOpenSelector = exports.getSelectedTool = exports.getToolState = undefined;
var r = require("./17.js");
var i = require("./81.js");
var o = require("./146.js");
exports.getToolState = (e, t) => e.toolState[t];
const a = exports.getSelectedTool = e => e.selectedTool;
const s = exports.colorPickerOpenSelector = (0, r.createSelector)(a, e => o.Tools[e].usesSwatches);
exports.getLineTypePickerActive = s;
const l = exports.getTrackLinesLocked = e => e.trackLinesLocked;
exports.getSelectedLineType = e => l(e) ? i.SCENERY_LINE : e.selectedLineType;
exports.getSelectedSceneryWidth = e => e.selectedSceneryWidth;
exports.getCursor = e => o.Tools[e.selectedTool].getCursor(e);
exports.getToolSceneLayer = e => o.Tools[e.selectedTool].getSceneLayer(e);
exports.getNextFrameLifelock = e => e.nextFrameLifelock;