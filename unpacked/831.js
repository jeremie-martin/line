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
var i = b(require("./0.js"));
var o = require("./15.js");
var a = require("./17.js");
var s = b(require("./5.js"));
var l = function (e) {
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
}(require("./22.js"));
var u = b(require("./2.js"));
var c = require("./241.js");
var d = require("./114.js");
var f = b(require("./19.js"));
var p = require("./278.js");
var h = require("./103.js");
var m = b(require("./847.js"));
var y = b(require("./848.js"));
var g = require("./8.js");
var v = b(require("./242.js"));
function b(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const _ = "@media (max-width: 450px) and (min-height: 430px)";
const w = "@media (min-width: 451px) and (max-width: 560px) and (min-height: 430px)";
const x = {
  root: {
    draggable: "false",
    zIndex: 0,
    position: "absolute",
    bottom: "8px",
    left: 50,
    right: 50,
    textAlign: "center",
    backgroundColor: "rgba(255, 255, 255, 0.93)",
    borderRadius: 2,
    [_]: {
      left: 0,
      right: 0,
      bottom: 0,
      paddingBottom: "8px",
      borderRadius: 0,
      "@media (min-width: 368px)": {
        left: "6px",
        right: "6px",
        bottom: "8px",
        paddingBottom: 0,
        borderRadius: 2
      }
    },
    "@media (min-width: 640px)": {},
    "@media (max-height: 414px)": {
      bottom: 0,
      borderRadius: 0
    },
    "@media (min-width: 451px)": {
      left: "75px",
      right: "75px",
      [w]: {
        left: "6px",
        right: "6px",
        bottom: "8px",
        paddingBottom: 0,
        borderRadius: 2
      }
    }
  },
  timeline: {
    borderRadius: "2px",
    position: "relative",
    background: c.grey[400],
    height: "5px",
    cursor: "pointer",
    overflow: "visible",
    "-webkit-tap-highlight-color": "rgba(0,0,0,0)",
    "& > $hitbox": {
      zIndex: 1
    },
    [_]: {
      marginLeft: 50,
      marginRight: 50,
      "@media (min-width: 368px)": {
        marginLeft: "44px",
        marginRight: "44px"
      }
    },
    "@media (min-width: 451px)": {
      [w]: {
        marginLeft: "44px",
        marginRight: "44px"
      }
    },
    "@media (max-width: 645px)": {
      marginBottom: "14px"
    }
  },
  buttons: {
    display: "inline-block"
  },
  button: {
    [_]: {
      width: "44px",
      height: "44px",
      "@media (min-width: 400px)": {
        width: "48px",
        height: "48px"
      }
    }
  },
  playhead: {
    position: "absolute",
    width: "16px",
    height: "16px",
    left: "0%",
    top: "-5px",
    cursor: "pointer",
    marginLeft: "-7px",
    "& > $hitbox": {
      zIndex: 3
    },
    "&:hover > $playheadCircle, &:active > $playheadCircle": {
      transform: "scale(1.2)"
    }
  },
  playheadCircle: {
    position: "absolute",
    width: "16px",
    height: "16px",
    background: c.grey[900],
    borderRadius: "50%",
    border: "1px solid rgba(255, 255, 255, 0.93)",
    left: 0,
    top: 0,
    zIndex: 5,
    overflow: "hidden",
    transition: "transform 100ms ease-in-out",
    transform: "scale(1.0)",
    transformOrigin: "50% 50%"
  },
  currentTimeIndicator: {
    display: "inline",
    pointerEvents: "none",
    position: "absolute",
    left: "5px",
    top: "10px",
    [_]: {
      left: 50,
      "@media (min-width: 368px)": {
        left: "44px"
      }
    },
    [w]: {
      left: "44px"
    }
  },
  maxTimeIndicator: {
    display: "inline",
    pointerEvents: "none",
    position: "absolute",
    right: "5px",
    top: "10px",
    [_]: {
      right: 50,
      "@media (min-width: 368px)": {
        right: "44px"
      }
    },
    [w]: {
      right: "44px"
    }
  },
  stopButton: {
    "@media (max-width: 359px)": {
      display: "none"
    }
  },
  onionStartMarker: {
    position: "absolute",
    width: "18px",
    height: "7px",
    top: "-1px",
    overflow: "visible",
    marginLeft: "-18px",
    "& > $hitbox": {
      left: "-15px",
      zIndex: 2
    },
    "& > $onionMarkerSvg": {
      transformOrigin: "100% 50%"
    },
    "&:hover > $onionMarkerSvg, &:active > $onionMarkerSvg": {
      transform: "scale(1.2)"
    }
  },
  onionEndMarker: {
    position: "absolute",
    width: "18px",
    height: "7px",
    top: "-1px",
    overflow: "visible",
    "& > $hitbox": {
      right: "-15px",
      zIndex: 2
    },
    "& > $onionMarkerSvg": {
      transformOrigin: "0% 50%"
    },
    "&:hover > $onionMarkerSvg, &:active > $onionMarkerSvg": {
      transform: "scale(1.2)"
    }
  },
  onionSkinLine: {
    position: "absolute",
    height: "0",
    top: "2px",
    borderBottom: `1px dotted ${c.grey[700]}`
  },
  hitbox: {
    overflow: "visible",
    position: "absolute",
    left: "-10px",
    top: "-15px",
    right: "-10px",
    bottom: "-10px",
    borderRadius: "10px"
  },
  onionMarkerSvg: {
    transition: "transform 100ms ease-in-out",
    transform: "scale(1.0)",
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    overflow: ["visible", "!important"],
    zIndex: 4
  },
  maxIndexHead: {
    width: "12px",
    height: "13px",
    position: "absolute",
    marginLeft: "-6px",
    top: "-4px",
    transition: "top 200ms ease-in-out",
    "& > $hitbox": {
      left: "-6px",
      top: "-20px",
      right: "-18px",
      zIndex: 2
    },
    "&:hover > $maxIndexSvg, &:active > $maxIndexSvg": {
      transform: "scale(1.2)"
    }
  },
  maxIndexSvg: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    overflow: ["visible", "!important"],
    zIndex: 4,
    transition: "transform 100ms ease-in-out",
    transformOrigin: "0% 50%",
    transform: "scale(1)"
  },
  flagHead: {
    width: "14px",
    height: "14px",
    position: "absolute",
    top: "-14px",
    transition: "top 200ms ease-in-out",
    marginLeft: "-1px",
    "& > $hitbox": {
      top: "-20px",
      zIndex: 2
    },
    "&:hover > $flagIcon, &:active > $flagIcon": {
      transform: "scale(1.2)"
    }
  },
  flagIcon: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    overflow: ["visible", "!important"],
    zIndex: 4,
    transition: "transform 100ms ease-in-out",
    transformOrigin: "11% 100%",
    transform: "scale(1)"
  }
};
exports.default = (0, o.connect)((0, a.createStructuredSelector)({
  maxIndexHeadVisible: e => !e.license.trial,
  player: e => e.player,
  onionSkin: g.getOnionSkinActive,
  onionBeginIndex: e => Math.max(0, e.player.index - e.renderer.onionSkinFramesBefore),
  onionEndIndex: e => Math.max(0, e.player.index + e.renderer.onionSkinFramesAfter)
}), {
  setFrameIndex: p.setFrameIndex,
  setOnionSkinFramesBefore: h.setOnionSkinFramesBefore,
  setOnionSkinFramesAfter: h.setOnionSkinFramesAfter,
  setPlayerMaxIndex: p.setPlayerMaxIndex,
  setFlagIndex: p.setFlagIndex
})((0, u.default)(x)(class extends i.default.PureComponent {
  constructor(e) {
    super(e);
    this.onOnionBeginPercentChanged = this.onOnionBeginPercentChanged.bind(this);
    this.onOnionEndPercentChanged = this.onOnionEndPercentChanged.bind(this);
    this.onPlayheadPercentChanged = this.onPlayheadPercentChanged.bind(this);
    this.onBeginSettingMaxIndex = this.onBeginSettingMaxIndex.bind(this);
    this.onEndSettingMaxIndex = this.onEndSettingMaxIndex.bind(this);
    this.onMaxIndexPercentChanged = this.onMaxIndexPercentChanged.bind(this);
    this.onFlagPercentChanged = this.onFlagPercentChanged.bind(this);
    this.onTimelineRef = e => this.timeline = e;
    this.getTimelineClientRect = () => this.timeline && this.timeline.getBoundingClientRect();
    this.currentTimeIndicatorClasses = {
      caption: e.classes.currentTimeIndicator
    };
    this.maxTimeIndicatorClasses = {
      caption: e.classes.maxTimeIndicator
    };
    this.state = {};
  }
  onPlayheadPercentChanged(e) {
    let t = e / 100;
    let n = Math.round(this.props.player.maxIndex * t);
    this.props.setFrameIndex(n);
  }
  onOnionBeginPercentChanged(e) {
    let t = Math.round(this.props.player.maxIndex * e / 100);
    if (t > this.props.player.index) {
      t = Math.ceil(this.props.player.index);
    }
    let n = Math.floor(this.props.player.index) - t;
    this.props.setOnionSkinFramesBefore(n);
  }
  onOnionEndPercentChanged(e) {
    let t = Math.round(this.props.player.maxIndex * e / 100);
    if (t < this.props.player.index) {
      t = Math.floor(this.props.player.index);
    }
    let n = t - Math.floor(this.props.player.index);
    this.props.setOnionSkinFramesAfter(n);
  }
  onFlagPercentChanged(e) {
    let t = e / 100;
    let n = Math.round(this.props.player.maxIndex * t);
    this.props.setFlagIndex(n);
  }
  onBeginSettingMaxIndex() {
    this.setState({
      oldMaxIndex: this.props.player.maxIndex
    });
  }
  onEndSettingMaxIndex() {
    this.setState({
      oldMaxIndex: null,
      uiMaxIndexPercent: null
    });
  }
  onMaxIndexPercentChanged(e, t) {
    let n = Math.round(this.state.oldMaxIndex * t / 100);
    this.setState({
      uiMaxIndexPercent: e
    }, () => this.props.setPlayerMaxIndex(n));
  }
  render() {
    var e = this.props;
    let t = e.items;
    let n = e.advancedTimeline;
    let o = e.classes;
    let a = e.player;
    let u = e.onionSkin;
    let p = e.onionBeginIndex;
    let h = e.onionEndIndex;
    let g = e.maxIndexHeadVisible;
    let b = 0;
    let _ = 0;
    let w = 0;
    let x = 0;
    let E = 0;
    const S = this.state.oldMaxIndex ?? a.maxIndex;
    if (S > 0) {
      b = a.index / S * 100;
      _ = p / S * 100;
      w = Math.min(a.maxIndex, h) / S * 100;
      x = a.maxIndex / S * 100;
      E = a.flagIndex / S * 100;
    }
    if (this.state.uiMaxIndexPercent != null) {
      x = this.state.uiMaxIndexPercent;
    }
    return i.default.createElement("div", {
      className: `${o.root} ${d.HOVER_CONTROL_CLASS}`
    }, i.default.createElement("div", {
      ref: this.onTimelineRef,
      className: o.timeline
    }, i.default.createElement(y.default, {
      getTimelineClientRect: this.getTimelineClientRect,
      onPercentChanged: this.onPlayheadPercentChanged,
      clickToSeek: true
    }, i.default.createElement("div", {
      className: o.hitbox
    })), n && g && i.default.createElement(y.default, {
      percent: x,
      getTimelineClientRect: this.getTimelineClientRect,
      onPercentChanged: this.onMaxIndexPercentChanged,
      onBeginScrubbing: this.onBeginSettingMaxIndex,
      onEndScrubbing: this.onEndSettingMaxIndex,
      overScrub: true
    }, i.default.createElement("div", {
      className: o.maxIndexHead
    }, i.default.createElement("svg", {
      preserveAspectRatio: "none",
      className: o.maxIndexSvg,
      viewBox: "0 0 12 13"
    }, i.default.createElement("polygon", {
      fill: c.grey[400],
      points: "4,1 9,1 9,12 4,12",
      overflow: "visible"
    })), i.default.createElement("div", {
      className: o.hitbox
    }))), n && i.default.createElement(y.default, {
      percent: E,
      getTimelineClientRect: this.getTimelineClientRect,
      onPercentChanged: this.onFlagPercentChanged
    }, i.default.createElement("div", {
      className: o.flagHead
    }, i.default.createElement("svg", {
      preserveAspectRatio: "none",
      className: o.flagIcon,
      viewBox: "3 3 18 18"
    }, i.default.createElement(l.FlagVariant.Path, {
      fill: c.grey[900],
      stroke: "rgba(255, 255, 255, 0.93)",
      strokeWidth: `${18 / 14}px`
    })), i.default.createElement("div", {
      className: o.hitbox
    }))), n && u && i.default.createElement(i.default.Fragment, null, i.default.createElement("div", {
      className: o.onionSkinLine,
      style: {
        left: `${_}%`,
        right: `${100 - w}%`
      }
    }), i.default.createElement(y.default, {
      percent: _,
      getTimelineClientRect: this.getTimelineClientRect,
      onPercentChanged: this.onOnionBeginPercentChanged
    }, i.default.createElement("div", {
      className: o.onionStartMarker
    }, i.default.createElement("svg", {
      preserveAspectRatio: "none",
      className: o.onionMarkerSvg,
      viewBox: "0 0 18 7"
    }, i.default.createElement("polygon", {
      fill: c.grey[600],
      stroke: "rgba(255, 255, 255, 0.93)",
      strokeWidth: "1px",
      points: "0,0 13.5,0 18,3.5 13.5,7 0,7",
      overflow: "visible"
    })), i.default.createElement("div", {
      className: o.hitbox
    }))), i.default.createElement(y.default, {
      percent: w,
      getTimelineClientRect: this.getTimelineClientRect,
      onPercentChanged: this.onOnionEndPercentChanged
    }, i.default.createElement("div", {
      className: o.onionEndMarker
    }, i.default.createElement("svg", {
      preserveAspectRatio: "none",
      className: o.onionMarkerSvg,
      viewBox: "0 0 18 7"
    }, i.default.createElement("polygon", {
      fill: c.grey[600],
      stroke: "rgba(255, 255, 255, 0.93)",
      strokeWidth: "1px",
      points: "0,3.5 4.5,0 18,0 18,7 4.5,7",
      overflow: "visible"
    })), i.default.createElement("div", {
      className: o.hitbox
    })))), i.default.createElement(y.default, {
      percent: b,
      getTimelineClientRect: this.getTimelineClientRect,
      onPercentChanged: this.onPlayheadPercentChanged
    }, i.default.createElement("div", {
      className: o.playhead
    }, i.default.createElement("div", {
      className: o.playheadCircle
    }), i.default.createElement("div", {
      className: o.hitbox
    })))), i.default.createElement("div", {
      className: o.buttons
    }, i.default.createElement(f.default, {
      component: "span",
      classes: this.currentTimeIndicatorClasses,
      type: "caption"
    }, i.default.createElement(m.default, {
      frameIndex: this.props.player.index,
      fps: this.props.player.settings.fps
    })), t.map((e, t) => {
      let n = e.hideWhenSmall;
      let a = function (e, t) {
        var n = {};
        for (var r in e) {
          if (!(t.indexOf(r) >= 0)) {
            if (Object.prototype.hasOwnProperty.call(e, r)) {
              n[r] = e[r];
            }
          }
        }
        return n;
      }(e, ["hideWhenSmall"]);
      return i.default.createElement(v.default, r({
        key: t,
        className: (0, s.default)(o.button, n && o.stopButton)
      }, a));
    }), i.default.createElement(f.default, {
      component: "span",
      classes: this.maxTimeIndicatorClasses,
      type: "caption"
    }, i.default.createElement(m.default, {
      frameIndex: this.props.player.maxIndex,
      fps: this.props.player.settings.fps
    }))));
  }
}));
module.exports = exports.default;