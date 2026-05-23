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
var i = h(require("./0.js"));
var o = require("./17.js");
var a = require("./15.js");
var s = require("./8.js");
var l = h(require("./805.js"));
var u = h(require("./806.js"));
var c = h(require("./365.js"));
var d = h(require("./823.js"));
var f = h(require("./824.js"));
var p = h(require("./825.js"));
function h(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const m = (0, o.createSelector)(e => e.track, e => e.camera, e => e.dimensions, (e, {
  position: {
    x: t,
    y: n
  },
  zoom: r
}, {
  width: i,
  height: o
}) => e.selectLinesInRect({
  x: t - i / 2 / r - 2,
  y: n - o / 2 / r - 2,
  width: i / r + 4,
  height: o / r + 4
}));
exports.default = (0, a.connect)((0, o.createStructuredSelector)({
  rendererOptions: e => e.renderer,
  style: (0, o.createSelector)(s.getEditorDimensions, e => ({
    position: "absolute",
    width: e.width,
    height: e.height,
    overflow: "hidden"
  })),
  hasPlaybackDimensions: s.hasPlaybackDimensions,
  pixelRatio: s.getPixelRatio,
  spriteSheet: s.getSpriteSheet,
  camera: s.getCurrentCamera,
  dimensions: s.getEditorDimensions,
  lines: s.getSimulatorLines,
  flagIndex: s.getPlayerFlagIndex,
  index: s.getPlayerIndex,
  track: s.getSimulatorTrack,
  viewOptions: s.getViewOptions,
  colorPlayback: s.getColorPlayback,
  millionsEnabled: s.getMillionsEnabled,
  rendererScenes: s.getRendererScenes,
  toolSceneLayer: e => !(0, s.getPlayerRunning)(e) && (0, s.getToolSceneLayer)(e),
  onionSkin: s.getOnionSkinActive,
  onionBeginIndex: s.getOnionBeginIndex,
  onionEndIndex: s.getOnionEndIndex,
  layers: s.getTrackLayers,
  numRiders: s.getNumRiders
}), null, (e, t, n) => Object.assign({}, e, n))(class extends i.default.Component {
  constructor(e) {
    super(e);
    this.entityGenerators = Array(e.numRiders).fill().map((e, t) => new d.default(t));
  }
  componentWillReceiveProps(e) {
    if (e.numRiders < this.props.numRiders) {
      this.entityGenerators.length = e.numRiders;
    } else if (e.numRiders > this.props.numRiders) {
      for (let t = this.props.numRiders; t < e.numRiders; t++) {
        this.entityGenerators.push(new d.default(t));
      }
    }
  }
  render() {
    let e = this.props.pixelRatio || window.devicePixelRatio || 1;
    var t = this.props;
    let n = t.preview;
    let o = t.lines;
    let a = t.dimensions;
    let s = t.camera;
    let d = t.track;
    let h = t.flagIndex;
    let y = t.index;
    let g = t.onionSkin;
    let v = t.onionBeginIndex;
    let b = t.onionEndIndex;
    let _ = this.props.viewOptions.flag;
    let w = this.entityGenerators.map(e => e.getEntities(d, undefined, y, !n && _, h, !n && g, v, b));
    let x = null;
    if (this.props.millionsEnabled) {
      x = i.default.createElement(f.default, null, i.default.createElement(c.default, r({
        secondary: this.props.secondary,
        numRiders: this.props.numRiders,
        innerRef: this.props.innerRef,
        entitiesArray: w,
        lines: o,
        camera: s,
        dimensions: a,
        track: d,
        flagIndex: h,
        index: y,
        pixelRatio: e,
        spriteSvg: this.props.spriteSheet,
        color: this.props.secondary ? this.props.colorPlayback : this.props.viewOptions.color,
        toolSceneLayer: !n && this.props.toolSceneLayer,
        layers: this.props.layers,
        skeleton: this.props.viewOptions.skeleton
      }, this.props.rendererScenes)));
    } else {
      let t = {
        lines: m(this.props),
        dimensions: a,
        pixelRatio: e,
        camera: s,
        toolSceneLayer: !n && this.props.toolSceneLayer,
        color: !n && this.props.viewOptions.color
      };
      const o = {
        hq: window.hq,
        camera: s,
        dimensions: a,
        pixelRatio: e
      };
      x = i.default.createElement(i.default.Fragment, null, i.default.createElement(l.default, t), this.props.spriteSheet && w.map((e, t) => i.default.createElement(u.default, r({
        key: t
      }, o, {
        spriteSvg: this.props.spriteSheet[t],
        backgroundEntities: e.background,
        onionSkinEntities: e.onionSkin,
        foregroundEntities: e.foreground
      }))));
    }
    return i.default.createElement("div", {
      ref: "container",
      className: this.props.className,
      style: this.props.style
    }, x, !n && (this.props.rendererOptions.showViewport || this.props.rendererOptions.showVisibleAreas) && this.props.hasPlaybackDimensions && i.default.createElement(p.default, {
      showViewport: this.props.rendererOptions.showViewport,
      showVisibleAreas: this.props.rendererOptions.showVisibleAreas,
      camera: s,
      dimensions: a,
      pixelRatio: 1
    }));
  }
});
module.exports = exports.default;