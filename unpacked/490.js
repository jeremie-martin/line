Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.audio = function (e = i, {
  type: t,
  payload: n
}) {
  switch (t) {
    case r.NEW_TRACK:
    case r.LOAD_TRACK:
    case r.REMOVE_AUDIO:
      return i;
    case r.LOAD_AUDIO:
      return Object.assign({}, e, {
        enabled: n.enabled,
        name: n.enabled ? n.name : null,
        path: null,
        offset: i.offset
      });
    case r.LOAD_LOCAL_AUDIO:
      return Object.assign({}, e, {
        enabled: true,
        name: n.name,
        offset: i.offset,
        path: n.path
      });
    case r.SET_AUDIO_OFFSET:
      return Object.assign({}, e, {
        offset: n
      });
    case r.TOGGLE_AUDIO:
      return Object.assign({}, e, {
        enabled: !!e.name && !e.enabled
      });
    case r.SET_AUDIO_VOLUME:
      return Object.assign({}, e, {
        volume: n
      });
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
}(require("./7.js"));
const i = {
  enabled: false,
  name: null,
  path: null,
  offset: 0,
  volume: 1
};