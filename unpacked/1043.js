Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = Object.assign || function (e) {
  for (var t = 1; t < arguments.length; t++) {
    var n = arguments[t];
    for (var r in n) {
      if (Object.prototype.hasOwnProperty.call(n, r)) {
        e[r] = n[r];
      }
    }
  }
  return e;
};
var i = f(require("./0.js"));
var o = require("./15.js");
var a = require("./17.js");
var s = require("./313.js");
var l = require("./7.js");
var u = require("./39.js");
var c = f(require("./1044.js"));
var d = require("./8.js");
function f(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const p = (0, a.createStructuredSelector)({
  audioEnabled: d.getAudioEnabled,
  hardwareAcceleration: d.getMillionsEnabled,
  flagIndex: d.getPlayerFlagIndex,
  maxIndex: d.getPlayerMaxIndex,
  zoom: d.getPlaybackZoom,
  pan: d.getPlaybackFixedPosition,
  track: d.getSimulatorTrack,
  fps: d.getPlayerFps,
  trackDetails: d.getTrackDetails,
  frameRateSetting: d.getPlayerFrameRateSetting,
  cameraFocus: d.getPlaybackCameraFocus,
  previewColor: d.getColorPlayback
});
const h = {
  onClose: l.closeVideoExporter,
  deselect: () => e => e((0, u.triggerCommand)("triggers.select.deselect"))
};
exports.default = (0, o.connect)(p, h)(class extends i.default.Component {
  constructor(e) {
    super(e);
    this.onSave = (e, t = ".mp4") => {
      const n = this.props.trackDetails.title || Date.now();
      (0, s.saveAs)(e, n + t);
    };
  }
  render() {
    return i.default.createElement(c.default, r({}, this.props, {
      onSave: this.onSave
    }));
  }
});
module.exports = exports.default;