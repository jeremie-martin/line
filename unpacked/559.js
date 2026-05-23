Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.camera = function (e = s, {
  type: t,
  payload: n
}) {
  switch (t) {
    case i.RESIZE:
      return Object.assign({}, e, {
        editorDimensions: n
      });
    case i.NEW_TRACK:
      return Object.assign({}, s, {
        playbackFollower: new a.default(e.playbackFollower),
        editorDimensions: e.editorDimensions
      });
    case i.LOAD_TRACK:
      return Object.assign({}, s, {
        playbackFollower: new a.default(e.playbackFollower),
        editorDimensions: e.editorDimensions,
        editorPosition: n.riders ? n.riders[0].startPosition : n.startPosition
      });
    case i.SET_EDITOR_CAMERA:
      return Object.assign({}, e, {
        editorPosition: n.position,
        editorZoom: n.zoom
      });
    case i.SET_EDITOR_FOLLOWER_FOCUS:
      return Object.assign({}, e, {
        editorFollowerFocus: n
      });
    case i.SET_PLAYBACK_ZOOM:
      return Object.assign({}, e, {
        playbackZoom: n
      });
    case i.SET_PLAYBACK_PAN:
      return Object.assign({}, e, {
        playbackFixedPosition: n
      });
    case i.SET_PLAYBACK_FOLLOWER_SETTINGS:
      return Object.assign({}, e, {
        playbackFollower: new a.default(Object.assign({}, e.playbackFollower, {
          settings: n
        }))
      });
    case i.SET_PLAYBACK_FOLLOWER_FOCUS:
      return Object.assign({}, e, {
        playbackFollower: new a.default(Object.assign({}, e.playbackFollower, {
          focus: n
        }))
      });
    case i.SET_PLAYBACK_DIMENSIONS:
      return Object.assign({}, e, {
        playbackDimensions: n
      });
    default:
      return e;
  }
};
var r;
var i = function (e) {
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
var o = require("./299.js");
var a = (r = o) && r.__esModule ? r : {
  default: r
};
const s = {
  editorPosition: {
    x: 0,
    y: 0
  },
  editorZoom: 2,
  editorDimensions: {
    width: 1,
    height: 1
  },
  editorFollowerFocus: 0,
  playbackFollower: new a.default(),
  playbackZoom: 2,
  playbackFixedPosition: {
    x: 0,
    y: 0
  },
  playbackDimensions: null
};