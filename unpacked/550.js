Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.renderer = function (e = {
  showViewport: false,
  showVisibleAreas: false,
  playbackPreview: false,
  colorPlayback: false,
  flag: null,
  skeleton: false,
  pixelRatio: 1,
  spriteSheets: null,
  millionsEnabled: false,
  edit: new o.default(),
  playback: new o.default(),
  onionSkin: false,
  onionSkinFramesBefore: 20,
  onionSkinFramesAfter: 20
}, {
  type: t,
  payload: n
}) {
  switch (t) {
    case a.SET_VIEW_OPTION:
      return Object.assign({}, e, {
        [n.key]: n.value ?? !e[n.key]
      });
    case a.SET_MILLIONS:
      return Object.assign({}, e, {
        millionsEnabled: n
      });
    case s.NEW_TRACK:
    case s.LOAD_TRACK:
      return Object.assign({}, e, {
        onionSkin: false,
        onionSkinFramesBefore: 20,
        onionSkinFramesAfter: 20
      });
    case a.SET_PIXEL_RATIO:
      return Object.assign({}, e, {
        pixelRatio: n
      });
    case a.SET_SPRITE_SHEETS:
      return Object.assign({}, e, {
        spriteSheets: n
      });
    case a.SET_ONION_SKIN:
      return Object.assign({}, e, {
        onionSkin: n
      });
    case a.SET_SKELETON:
      return Object.assign({}, e, {
        skeleton: n
      });
    case a.SET_ONION_SKIN_FRAMES_AFTER:
      return Object.assign({}, e, {
        onionSkinFramesAfter: n
      });
    case a.SET_ONION_SKIN_FRAMES_BEFORE:
      return Object.assign({}, e, {
        onionSkinFramesBefore: n
      });
    case a.SET_RENDERER_SCENE:
      return Object.assign({}, e, {
        [n.key]: n.scene
      });
    default:
      return e;
  }
};
var r;
var i = require("./207.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
var a = function (e) {
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
}(require("./103.js"));
var s = require("./7.js");