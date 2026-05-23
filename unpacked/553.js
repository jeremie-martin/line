Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.collapsedFolders = function (e = new Set(), {
  type: t,
  payload: n
}) {
  switch (t) {
    case a.COLLAPSE_FOLDER:
      e.add(n);
      return e;
    case a.EXPAND_FOLDER:
      e.delete(n);
      return e;
    default:
      return e;
  }
};
exports.simulator = function (e = {}, t) {
  let n = (0, i.engine)(e.engine, t);
  var r = e.history;
  let o = r === undefined ? [n] : r;
  var l = e.committedEngine;
  let u = l === undefined ? n : l;
  var c = e.lastSavedEngine;
  let d = c === undefined ? n : c;
  switch (t.type) {
    case a.UPDATE_LINES:
      if (t.payload.initialLoad) {
        o = [n];
        u = n;
        if (d != null) {
          d = n;
        }
      }
      break;
    case a.NEW_TRACK:
    case a.LOAD_TRACK:
      o = [n];
      u = n;
      d = t.payload.dirty ? null : n;
      break;
    case a.SAVE_TRACK:
      d = n;
      break;
    case a.UNDO:
      {
        let e = o.findIndex(e => e === n);
        if (e > 0) {
          n = o[e - 1];
          u = n;
        }
        break;
      }
    case a.REDO:
      {
        let e = o.findIndex(e => e === n);
        if (e >= 0 && e < o.length - 1) {
          n = o[e + 1];
          u = n;
        }
        break;
      }
    case a.COMMIT_TRACK_CHANGES:
      if (n !== u) {
        let e = o.findIndex(e => e === u);
        if (e === -1) {
          throw new Error("unable to find committed engine in history stack");
        }
        (o = [...o]).splice(e + 1);
        o.push(n);
        u = n;
      }
      break;
    case a.REVERT_TRACK_CHANGES:
      n = u;
      break;
    case a.SET_LAYER_ACTIVE:
    case a.SET_LAYER_VISIBLE:
    case a.SET_LAYER_EDITABLE:
    case a.SET_FOLDER_VISIBLE:
    case a.SET_FOLDER_EDITABLE:
    case a.EXPAND_FOLDER:
    case a.COLLAPSE_FOLDER:
      if (n.linesList === u.linesList) {
        let e = o.findIndex(e => e === u);
        if (e === -1) {
          throw new Error("unable to find committed engine in history stack");
        }
        (o = [...o])[e] = n;
        u = n;
      }
      break;
    case s.SET_TRACK_SCRIPT:
      d = null;
  }
  return {
    engine: n,
    history: o,
    committedEngine: u,
    lastSavedEngine: d
  };
};
var r;
var i = require("./554.js");
var o = require("./25.js");
if (r = o) {
  r.__esModule;
}
var a = require("./7.js");
var s = require("./55.js");