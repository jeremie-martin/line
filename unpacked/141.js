Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getNumRiders = exports.getCommittedRiders = exports.getRiders = exports.getSimulatorHasRedo = exports.getSimulatorHasUndo = exports.getActiveLayerEditable = exports.getTrackActiveLayerId = exports.getTrackLayers = exports.getCollapsedFolders = exports.getSimulatorTotalLineCount = exports.getSimulatorLineCount = exports.getTrackIsDirty = exports.getTrackIsEmpty = exports.getSimulatorTrackTotalLineCount = exports.getSimulatorVersion = exports.getSimulatorStartPos = exports.getSimulatorCommittedLines = exports.getSimulatorLines = exports.getSimulatorCommittedTrack = exports.getSimulatorTrack = undefined;
var r = require("./17.js");
var i = require("./142.js");
const o = exports.getSimulatorTrack = e => e.simulator.engine;
exports.getSimulatorCommittedTrack = e => e.simulator.committedEngine;
exports.getSimulatorLines = e => e.simulator.engine.linesList;
exports.getSimulatorCommittedLines = e => e.simulator.committedEngine.linesList;
exports.getSimulatorStartPos = e => e.simulator.engine.start.position;
exports.getSimulatorVersion = e => e.simulator.engine.isLegacy() ? "6.1" : "6.2";
const a = exports.getSimulatorTrackTotalLineCount = e => e.simulator.engine.linesList.size();
exports.getTrackIsEmpty = e => a(e) === 0;
exports.getTrackIsDirty = e => e.simulator.committedEngine !== e.simulator.lastSavedEngine;
const s = (0, r.createSelector)(e => e.simulator.engine, e => {
  var t = e.getLineCounts();
  return {
    total: t.total,
    lineCounts: function (e, t) {
      var n = {};
      for (var r in e) {
        if (!(t.indexOf(r) >= 0)) {
          if (Object.prototype.hasOwnProperty.call(e, r)) {
            n[r] = e[r];
          }
        }
      }
      return n;
    }(t, ["total"])
  };
});
exports.getSimulatorLineCount = s;
exports.getSimulatorTotalLineCount = e => s(e).total;
exports.getCollapsedFolders = e => e.collapsedFolders;
const l = exports.getTrackLayers = e => o(e).engine.state.layers;
const u = exports.getTrackActiveLayerId = e => o(e).engine.state.activeLayerId;
exports.getActiveLayerEditable = e => {
  const t = u(e);
  const n = l(e);
  const r = n.findIndex(e => e.id === t);
  if (r >= 0) {
    const e = n.get(r);
    return e.type !== i.LayerTypes.FOLDER && e.visible && e.editable;
  }
};
exports.getSimulatorHasUndo = (0, r.createSelector)(e => e.simulator.history, e => e.simulator.committedEngine, (e, t) => e.findIndex(e => e === t) > 0);
exports.getSimulatorHasRedo = (0, r.createSelector)(e => e.simulator.history, e => e.simulator.committedEngine, (e, t) => e.findIndex(e => e === t) < e.length - 1);
const c = exports.getRiders = e => e.simulator.engine.engine.state.riders;
exports.getCommittedRiders = e => e.simulator.committedEngine.engine.state.riders;
exports.getNumRiders = e => c(e).length;