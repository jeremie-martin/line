Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.selectedLineType = function (e = 0, {
  type: t,
  payload: n
}) {
  switch (t) {
    case r.SELECT_LINE_TYPE:
      return n;
    default:
      return e;
  }
};
exports.selectedSceneryWidth = function (e = 1, {
  type: t,
  payload: n
}) {
  switch (t) {
    case r.SELECT_SCENERY_WIDTH:
      return n;
    default:
      return e;
  }
};
exports.trackLinesLocked = function (e = false, {
  type: t
}) {
  switch (t) {
    case r.TOGGLE_TRACK_LINES_LOCKED:
      return !e;
    default:
      return e;
  }
};
exports.nextFrameLifelock = function (e = false, {
  type: t
}) {
  switch (t) {
    case r.TOGGLE_NEXT_FRAME_LIFELOCK:
      return !e;
    default:
      return e;
  }
};
exports.toolState = function (e = {}, {
  type: t,
  payload: n,
  meta: i
}) {
  switch (t) {
    case r.SET_TOOL_STATE:
      return Object.assign({}, e, {
        [i.id]: Object.assign({}, e[i.id], n)
      });
    default:
      return e;
  }
};
exports.settings = function (e = i, {
  type: t,
  payload: n,
  meta: o
}) {
  switch (t) {
    case r.LOAD_SETTINGS:
      return Object.assign({}, e, n);
    case r.SET_SETTING:
      return Object.assign({}, e, {
        [n.key]: n.value
      });
    case r.TOGGLE_SETTING:
      return Object.assign({}, e, {
        [n.key]: !e[n.key]
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
  "audio.slowMotion": false,
  "cam.useEditorFollower": true,
  "ui.undoRedoGestures": false,
  "ui.twoFingerPan": true,
  "ui.pinchToZoom": true,
  "pressure.min": 1,
  "pressure.max": 3,
  "pressure.enabled": false,
  "views.modsEnabled": false,
  "track.uncapScenery": false
};