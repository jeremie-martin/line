Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.engine = function (e, t) {
  if (!e) {
    return new r.FastLineRiderEngine();
  }
  switch (t.type) {
    case i.NEW_TRACK:
      return new r.FastLineRiderEngine();
    case i.LOAD_TRACK:
      return function (e, t, n) {
        let i;
        i = e === "6.1" ? new r.FastLineRiderEngine({
          legacy: true
        }) : new r.FastLineRiderEngine();
        if (n.riders) {
          i = i.setRiders(n.riders);
        } else {
          if (!n.startPosition) {
            throw new Error("Track does not have start position!");
          }
          i = i.setStart(n.startPosition);
        }
        if (n.layers) {
          i = i.setLayers(n.layers);
        }
        return i = i.addLines(t.map(r.createFastLineFromJson));
      }(t.payload.version, t.payload.lines || [], t.payload);
    case i.UPDATE_LINES:
      var n = t.payload;
      let o = n.linesToRemove;
      let a = n.linesToAdd;
      if (o) {
        e = e.removeLines(o);
      }
      if (a) {
        let n = (t, n) => (0, r.createFastLineFromJson)(function (e, t, n) {
          if (t.id != null) {
            return t;
          }
          return Object.assign({}, t, {
            id: e.getMaxLineID() + 1 + n
          });
        }(e, t, n));
        if (t.meta && (t.meta.name === "ADD_LINE" || t.meta.name === "ADD_LINES")) {
          const t = e.engine.state.activeLayerId;
          const r = n;
          n = (e, n) => {
            const i = r(e, n);
            if (t === 0) {
              delete i.layer;
            } else {
              i.layer = t;
            }
            return i;
          };
        }
        e = e.addLines(a.map(n));
      }
      return e;
    case i.ADD_LAYER:
      return new r.FastLineRiderEngine(null, e.engine.withLayerAdded(t.payload ? t.payload.name : ""));
    case i.REMOVE_LAYER:
      return new r.FastLineRiderEngine(null, e.engine.withLayerRemoved(t.payload.id));
    case i.MOVE_LAYER:
      return new r.FastLineRiderEngine(null, e.engine.withLayerMoved(t.payload.id, t.payload.index));
    case i.COPY_LAYER:
      return new r.FastLineRiderEngine(null, e.engine.withLayerCopied(t.payload.id));
    case i.RENAME_LAYER:
      return new r.FastLineRiderEngine(null, e.engine.withLayerRenamed(t.payload.id, t.payload.name));
    case i.SET_LAYER_ACTIVE:
      return new r.FastLineRiderEngine(null, e.engine.withLayerActive(t.payload.id));
    case i.SET_LAYER_VISIBLE:
      return new r.FastLineRiderEngine(null, e.engine.withLayerVisibilityChanged(t.payload.id, t.payload.visible));
    case i.SET_LAYER_EDITABLE:
      return new r.FastLineRiderEngine(null, e.engine.withLayerEditableChanged(t.payload.id, t.payload.editable));
    case i.ADD_FOLDER:
      return new r.FastLineRiderEngine(null, e.engine.withFolderAdded(t.payload.name));
    case i.REMOVE_FOLDER:
      return new r.FastLineRiderEngine(null, e.engine.withFolderRemoved(t.payload.id));
    case i.MOVE_FOLDER:
      return new r.FastLineRiderEngine(null, e.engine.withFolderMoved(t.payload.id, t.payload.index));
    case i.RENAME_FOLDER:
      return new r.FastLineRiderEngine(null, e.engine.withFolderRenamed(t.payload.id, t.payload.name));
    case i.SET_FOLDER_VISIBLE:
      return new r.FastLineRiderEngine(null, e.engine.withFolderVisibilityChanged(t.payload.id, t.payload.visible));
    case i.SET_FOLDER_EDITABLE:
      return new r.FastLineRiderEngine(null, e.engine.withFolderEditableChanged(t.payload.id, t.payload.editable));
    case i.SET_RIDERS:
      return new r.FastLineRiderEngine(null, e.engine.withRidersChanged(t.payload));
    default:
      return e;
  }
};
var r = require("./143.js");
var i = require("./7.js");