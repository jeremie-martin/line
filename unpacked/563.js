Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.savedTracks = function (e = null, {
  type: t,
  payload: n
}) {
  switch (t) {
    case r.LOAD_SAVED_TRACKS:
      return n;
    case r.PUT_SAVED_TRACK:
      return [n, ...e.filter(e => e.cloudInfo.trackId !== n.cloudInfo.trackId)];
    case r.REMOVE_SAVED_TRACK:
      return e.filter(e => e.cloudInfo.trackId !== n.cloudInfo.trackId);
    default:
      return e;
  }
};
exports.autosaveEnabled = function (e = true, {
  type: t,
  payload: n
}) {
  switch (t) {
    case r.SET_AUTOSAVE_ENABLED:
      return n;
    default:
      return e;
  }
};
var r = function (e) {
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
}(require("./108.js"));