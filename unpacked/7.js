Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ui = exports.trackData = exports.notifications = undefined;
var r = require("./491.js");
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
var i = require("./277.js");
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
var o = require("./278.js");
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
var a = require("./492.js");
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
var s = require("./139.js");
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
var l = require("./493.js");
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
var u = require("./103.js");
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
var c = require("./279.js");
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
var d = require("./198.js");
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
var f = require("./494.js");
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
var p = v(require("./29.js"));
var h = v(require("./55.js"));
var m = v(s);
var y = require("./8.js");
var g = require("./298.js");
function v(e) {
  if (e && e.__esModule) {
    return e;
  }
  var t = {};
  if (e != null) {
    for (var n in e) {
      if (Object.prototype.hasOwnProperty.call(e, n)) {
        t[n] = e[n];
      }
    }
  }
  t.default = e;
  return t;
}
exports.notifications = p;
exports.trackData = h;
exports.ui = m;
window.Actions = {
  commitTrackChanges: () => window.store.dispatch(module.exports.commitTrackChanges()),
  revertTrackChanges: () => window.store.dispatch(module.exports.revertTrackChanges()),
  addLines: t => {
    const n = new Set((0, y.getTrackLayers)(window.store.getState()).toArray().map(e => e.id));
    for (let e = 0; e < t.length; e++) {
      if (t[e].layer === undefined) {
        t[e].layer = (0, y.getTrackActiveLayerId)(window.store.getState());
      } else if (!n.has(t[e].layer)) {
        throw new Error("Line found on invalid layer!");
      }
    }
    window.store.dispatch(module.exports.setLines(t));
  },
  removeLines: t => window.store.dispatch(module.exports.removeLines(t)),
  addLayer: t => {
    const n = (0, y.getTrackLayers)(window.store.getState()).toArray();
    const r = Math.max(...n.map(e => e.id)) + 1;
    window.store.dispatch(module.exports.addLayer(t));
    return r;
  },
  removeLayer: t => window.store.dispatch(module.exports.removeLayer(t)),
  moveLayer: (t, n) => window.store.dispatch(module.exports.moveLayer(t, n)),
  renameLayer: (t, n) => window.store.dispatch(module.exports.renameLayer(t, n)),
  setLayerVisible: (t, n) => window.store.dispatch(module.exports.setLayerVisible(t, n)),
  setLayerEditable: (t, n) => window.store.dispatch(module.exports.setLayerEditable(t, n)),
  addFolder: t => {
    const n = (0, y.getTrackLayers)(window.store.getState()).toArray();
    const r = Math.max(...n.map(e => e.id)) + 1;
    window.store.dispatch(module.exports.addFolder(t));
    return r;
  },
  removeFolder: t => window.store.dispatch(module.exports.removeFolder(t)),
  moveFolder: (t, n) => window.store.dispatch(module.exports.moveFolder(t, n)),
  renameFolder: (t, n) => window.store.dispatch(module.exports.renameFolder(t, n)),
  setFolderVisible: (t, n) => window.store.dispatch(module.exports.setFolderVisible(t, n)),
  setFolderEditable: (t, n) => window.store.dispatch(module.exports.setFolderEditable(t, n)),
  setRiders: t => window.store.dispatch(module.exports.setRiders(t)),
  setEditScene: t => window.store.dispatch(module.exports.setRendererScene("edit", t)),
  setTool: t => window.store.dispatch(module.exports.setTool(t)),
  setSpriteSheet: e => (0, g.loadSpriteSheets)(e)(window.store.dispatch)
};