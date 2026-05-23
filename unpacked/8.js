Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = require("./280.js");
Object.keys(r).forEach(function (e) {
  if (e !== "default" && e !== "__esModule") {
    Object.defineProperty(exports, e, {
      enumerable: true,
      get: function () {
        return r[e];
      }
    });
  }
});
var i = require("./140.js");
Object.keys(i).forEach(function (e) {
  if (e !== "default" && e !== "__esModule") {
    Object.defineProperty(exports, e, {
      enumerable: true,
      get: function () {
        return i[e];
      }
    });
  }
});
var o = require("./495.js");
Object.keys(o).forEach(function (e) {
  if (e !== "default" && e !== "__esModule") {
    Object.defineProperty(exports, e, {
      enumerable: true,
      get: function () {
        return o[e];
      }
    });
  }
});
var a = require("./141.js");
Object.keys(a).forEach(function (e) {
  if (e !== "default" && e !== "__esModule") {
    Object.defineProperty(exports, e, {
      enumerable: true,
      get: function () {
        return a[e];
      }
    });
  }
});
var s = require("./498.js");
Object.keys(s).forEach(function (e) {
  if (e !== "default" && e !== "__esModule") {
    Object.defineProperty(exports, e, {
      enumerable: true,
      get: function () {
        return s[e];
      }
    });
  }
});
var l = require("./540.js");
Object.keys(l).forEach(function (e) {
  if (e !== "default" && e !== "__esModule") {
    Object.defineProperty(exports, e, {
      enumerable: true,
      get: function () {
        return l[e];
      }
    });
  }
});
var u = require("./541.js");
Object.keys(u).forEach(function (e) {
  if (e !== "default" && e !== "__esModule") {
    Object.defineProperty(exports, e, {
      enumerable: true,
      get: function () {
        return u[e];
      }
    });
  }
});
var c = require("./542.js");
Object.keys(c).forEach(function (e) {
  if (e !== "default" && e !== "__esModule") {
    Object.defineProperty(exports, e, {
      enumerable: true,
      get: function () {
        return c[e];
      }
    });
  }
});
var d = require("./281.js");
Object.keys(d).forEach(function (e) {
  if (e !== "default" && e !== "__esModule") {
    Object.defineProperty(exports, e, {
      enumerable: true,
      get: function () {
        return d[e];
      }
    });
  }
});
var f = require("./543.js");
Object.keys(f).forEach(function (e) {
  if (e !== "default" && e !== "__esModule") {
    Object.defineProperty(exports, e, {
      enumerable: true,
      get: function () {
        return f[e];
      }
    });
  }
});
window.Selectors = {
  getEditorZoom: () => module.exports.getEditorZoom(window.store.getState()),
  getEditorPosition: () => module.exports.getEditorPosition(window.store.getState()),
  getPlaybackCameraAtIndex: t => module.exports.getPlaybackCameraAtIndex(window.store.getState(), t),
  getPlayerIndex: () => module.exports.getPlayerIndex(window.store.getState()),
  getSimulatorTrack: () => module.exports.getSimulatorTrack(window.store.getState()),
  getSimulatorCommittedTrack: () => module.exports.getSimulatorCommittedTrack(window.store.getState()),
  getSimulatorLines: () => module.exports.getSimulatorLines(window.store.getState()).toArray(),
  getSimulatorCommittedLines: () => module.exports.getSimulatorCommittedLines(window.store.getState()).toArray(),
  getTrackLayers: () => module.exports.getTrackLayers(window.store.getState()).toArray(),
  getRiders: () => module.exports.getRiders(window.store.getState()),
  getCommittedRiders: () => module.exports.getCommittedRiders(window.store.getState()),
  getNumRiders: () => module.exports.getNumRiders(window.store.getState()),
  getToolState: t => module.exports.getToolState(window.store.getState(), t),
  getSelectedLineType: () => module.exports.getSelectedLineType(window.store.getState()),
  getSelectedSceneryWidth: () => module.exports.getSelectedSceneryWidth(window.store.getState())
};