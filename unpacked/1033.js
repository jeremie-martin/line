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
var i = I(require("./0.js"));
var o = require("./15.js");
var a = require("./17.js");
var s = require("./8.js");
var l = require("./7.js");
var u = require("./35.js");
var c = require("./39.js");
var d = require("./110.js");
var f = require("./22.js");
var p = I(require("./2.js"));
var h = I(require("./176.js"));
var m = require("./46.js");
var y = I(require("./60.js"));
var g = I(require("./95.js"));
var v = I(require("./19.js"));
var b = I(require("./177.js"));
var _ = I(require("./175.js"));
var w = require("./63.js");
var x = I(require("./132.js"));
require("./26.js");
var E = I(require("./247.js"));
var S = require("./1034.js");
var T = require("./113.js");
var k = I(require("./130.js"));
var O = require("./414.js");
var P = require("./55.js");
var C = function (e) {
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
}(require("./27.js"));
function I(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
class M extends i.default.PureComponent {
  constructor(e) {
    super(e);
    this.onChange = e => {
      document.activeElement.blur();
      this.props.onChange(e);
    };
  }
  render() {
    var e = this.props;
    let t = e.Component;
    let n = function (e, t) {
      var n = {};
      for (var r in e) {
        if (!(t.indexOf(r) >= 0)) {
          if (Object.prototype.hasOwnProperty.call(e, r)) {
            n[r] = e[r];
          }
        }
      }
      return n;
    }(e, ["Component"]);
    return i.default.createElement(t, r({}, n, {
      onChange: this.onChange
    }));
  }
}
const L = (0, a.createStructuredSelector)({
  showAdvancedSettings: e => !e.license.trial,
  rendererOptions: e => e.renderer,
  settings: e => e.settings,
  playerSettings: s.getPlayerSettings,
  trackLinesLocked: s.getTrackLinesLocked,
  colorPlayback: s.getColorPlayback,
  playbackPreview: s.getPlaybackPreview,
  useEditorFollower: s.getUseEditorFollower,
  audio: s.getAudioProps,
  audioFileLoading: s.getAudioFileLoading,
  numRiders: s.getNumRiders,
  playbackCameraFocus: s.getPlaybackCameraFocus,
  editorFollowerFocus: s.getEditorFollowerFocus,
  playbackZoom: s.getPlaybackZoom,
  playbackDimensions: e => e.camera.playbackDimensions,
  trackScript: s.getTrackScript,
  commandHotkeys: u.getCommandHotkeys,
  commandTags: u.getCommandTags,
  modsEnabled: s.getModsEnabled,
  activeTool: s.getSelectedTool
});
let R = {
  setViewOption: l.setViewOption,
  setPlaybackDimensions: l.setPlaybackDimensions,
  setPlaybackZoom: l.setPlaybackZoom,
  toggleSetting: l.toggleSetting,
  setPlayerSettings: l.setPlayerSettings,
  toggleInterpolate: l.toggleInterpolate,
  setInterpolate: l.setInterpolate,
  toggleTrackLinesLocked: () => (0, c.triggerCommand)("triggers.toggleTrackLinesLocked"),
  toggleColorPlayback: l.toggleColorPlayback,
  togglePlaybackPreview: l.togglePlaybackPreview,
  loadAudioFile: d.loadAudioFile,
  toggleAudio: l.toggleAudio,
  setAudioOffset: l.setAudioOffset,
  setAudioVolume: l.setAudioVolume,
  removeAudio: l.removeAudio,
  setNumRiders: S.setNumRiders,
  togglePlaybackFollowerFocus: T.togglePlaybackFollowerFocus,
  setEditorFollowerFocus: l.setEditorFollowerFocus,
  adjustStartPositions: S.adjustStartPositions,
  setTrackScript: P.setTrackScript,
  setCommandHotkeys: c.setCommandHotkeys,
  restoreDefaultKeys: c.restoreDefaultKeys,
  closeSidebar: l.closeSidebar,
  setTool: l.setTool
};
const A = e => e.preventDefault();
const D = e => {
  try {
    eval.call(window, e);
  } catch (e) {
    console.error(e);
    return e;
  }
};
exports.default = (0, o.connect)(L, R)((0, p.default)(e => ({
  root: {
    marginTop: 8
  },
  formContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  audioInput: {
    display: "none"
  },
  script: {
    fontFamily: "monospace",
    width: "100%",
    height: "20em"
  },
  hotkeyRow: {
    display: "flex",
    justifyContent: "space-between",
    fontFamily: "monospace",
    fontSize: e.typography.caption.fontSize,
    lineHeight: e.typography.caption.lineHeight,
    borderBottom: `1px solid ${e.palette.divider}`,
    userSelect: "none"
  },
  hotkeyInput: {
    border: "none",
    textAlign: "right",
    width: "16ch"
  }
}))(class extends i.default.Component {
  constructor(e) {
    super(e);
    this.onAudioFileInput = e => {
      e.preventDefault();
      const t = e.target.files[0];
      if (t) {
        this.props.loadAudioFile(t);
      }
      e.target.value = null;
    };
    this.onAudioFileDrop = e => {
      e.preventDefault();
      const t = e.dataTransfer.files[0];
      if (t) {
        this.props.loadAudioFile(t);
      }
      e.target.value = null;
    };
    document.documentElement.addEventListener("dragover", A);
    document.documentElement.addEventListener("drop", this.onAudioFileDrop);
    this.state = {
      keyCombination: "",
      keyCollision: "",
      currentCommand: "",
      playbackWidth: "",
      playbackHeight: "",
      playbackZoom: Math.log2(this.props.playbackZoom).toString()
    };
    this.onRenderHotkeyName = e => {
      const t = e.replace(/(triggers\.)|(modifiers\.)/, "").replaceAll(/\.\w/g, e => e ? e.slice(1).toUpperCase() : "").replaceAll(/[A-Z]/g, e => " " + e);
      return t.slice(0, 1).toUpperCase() + t.slice(1);
    };
  }
  onToggleMods(e) {
    if (e && !Object.values(C).includes(this.props.activeTool)) {
      this.props.setTool(C.PENCIL_TOOL);
    }
    this.props.toggleSetting("views.modsEnabled");
  }
  componentWillUnmount() {
    document.documentElement.removeEventListener("dragover", A);
    document.documentElement.removeEventListener("drop", this.onAudioFileDrop);
  }
  onSetResolution(e) {
    this.props.setPlaybackDimensions(e);
    this.setState({
      playbackWidth: e.width,
      playbackHeight: e.height
    });
  }
  render() {
    var e = this.props;
    let t = e.showAdvancedSettings;
    let n = e.rendererOptions;
    let r = e.setViewOption;
    let o = e.playbackDimensions;
    let a = e.setPlaybackDimensions;
    let s = e.setPlaybackZoom;
    let l = e.toggleSetting;
    e.settings;
    var u = e.playerSettings;
    let c = u.interpolate;
    let d = u.fps;
    let p = u.maxDuration;
    e.toggleInterpolate;
    let S = e.setInterpolate;
    let T = e.colorPlayback;
    let P = e.toggleColorPlayback;
    let C = e.playbackPreview;
    let I = e.togglePlaybackPreview;
    let L = e.trackLinesLocked;
    let R = e.toggleTrackLinesLocked;
    let A = e.useEditorFollower;
    let N = e.audio;
    let j = e.audioFileLoading;
    let F = e.setAudioOffset;
    let B = e.setPlayerSettings;
    let U = e.toggleAudio;
    let z = e.setAudioVolume;
    let H = e.removeAudio;
    let V = e.playbackZoom;
    let W = e.trackScript;
    let q = e.setTrackScript;
    let G = e.commandHotkeys;
    let K = e.setCommandHotkeys;
    let Y = e.restoreDefaultKeys;
    let $ = e.commandTags;
    let X = e.modsEnabled;
    let Z = e.classes;
    return i.default.createElement("div", {
      className: Z.root
    }, i.default.createElement(i.default.Fragment, null, i.default.createElement(x.default, {
      heading: "General",
      Icon: f.Settings.Icon
    }, i.default.createElement(m.FormControl, null, i.default.createElement(w.InputLabel, null, "Playback Frame Rate"), i.default.createElement(M, {
      Component: _.default,
      native: true,
      value: "" + c,
      onChange: e => S(JSON.parse(e.currentTarget.value))
    }, i.default.createElement("option", {
      value: true
    }, "Smooth (variable)"), i.default.createElement("option", {
      value: false
    }, "Physics (", d, " fps)"), i.default.createElement("option", {
      value: 60
    }, "Video (60 fps)"))), i.default.createElement(m.FormControlLabel, {
      label: "Playback Preview",
      control: i.default.createElement(M, {
        Component: h.default,
        checked: C,
        onChange: I
      })
    }), i.default.createElement(m.FormControlLabel, {
      label: "Show Line Colors in Playback",
      control: i.default.createElement(M, {
        Component: h.default,
        checked: T,
        onChange: P
      })
    }), i.default.createElement(m.FormControlLabel, {
      label: "Lock Track Lines",
      control: i.default.createElement(M, {
        Component: h.default,
        checked: L,
        onChange: R
      })
    })), i.default.createElement(x.default, {
      heading: "Hotkeys",
      Icon: f.Keyboard.Icon
    }, i.default.createElement("div", {
      style: {
        marginBottom: 24
      }
    }, i.default.createElement(y.default, {
      raised: true,
      component: "span",
      size: "small",
      onClick: () => {
        if (confirm("Restore default hotkeys?")) {
          Y();
        }
      }
    }, "Restore Defaults"), i.default.createElement(g.default, {
      style: {
        float: "right"
      },
      title: "Press enter to confirm hotkey"
    }, f.HelpCircle.Icon())), Object.keys(G).map(e => {
      if ($[e] !== undefined) {
        return !$[e].readonly && !$[e].hidden && i.default.createElement("div", {
          key: e,
          className: Z.hotkeyRow
        }, i.default.createElement("label", {
          htmlFor: e
        }, this.onRenderHotkeyName(e)), i.default.createElement("input", {
          id: e,
          className: Z.hotkeyInput,
          type: "text",
          readOnly: true,
          placeholder: "Press A-Z Key",
          value: this.state.currentCommand !== e ? G[e].toUpperCase() : this.state.keyCombination.toUpperCase(),
          onKeyDown: t => {
            t.preventDefault();
            if (t.key !== "Enter" && t.key !== "Escape") {
              if (t.key.length === 1 && t.key.match(/[a-z]/)) {
                this.setState({
                  keyCollision: ""
                });
                for (const n of Object.keys(G)) {
                  if (!$[n].hidden && !$[n].readonly && e !== n && G[n] === t.key) {
                    this.setState({
                      keyCollision: n
                    });
                    break;
                  }
                }
                this.setState({
                  keyCombination: t.key
                });
              }
            } else {
              t.target.blur();
              if (this.state.keyCombination.length === 0 || t.key === "Escape") {
                return;
              }
              if (this.state.keyCollision !== "") {
                const t = `Collision with ${this.onRenderHotkeyName(this.state.keyCollision)} found. Swap keys?`;
                if (!confirm(t)) {
                  return;
                }
                K({
                  [this.state.keyCollision]: G[e]
                });
                const n = $[this.state.keyCollision].complement;
                if (n) {
                  const t = [...($[n].modifiers || []), G[e]].join("+");
                  K({
                    [n]: t
                  });
                }
              }
              const n = $[e].complement;
              if (n) {
                const e = [...($[n].modifiers || []), this.state.keyCombination].join("+");
                K({
                  [n]: e
                });
              }
              K({
                [e]: this.state.keyCombination
              });
            }
          },
          onBlur: () => {
            this.setState({
              keyCombination: ""
            });
            this.setState({
              currentCommand: ""
            });
          },
          onFocus: () => {
            this.setState({
              currentCommand: e
            });
          }
        }));
      }
      console.error("Error loading command:", e);
    }), Object.keys(G).map(e => {
      if ($[e] !== undefined) {
        return $[e].readonly && !$[e].hidden && i.default.createElement("div", {
          key: e,
          style: {
            backgroundColor: "lightgray"
          },
          className: Z.hotkeyRow
        }, i.default.createElement("label", {
          htmlFor: e
        }, this.onRenderHotkeyName(e)), i.default.createElement("input", {
          id: e,
          className: Z.hotkeyInput,
          type: "text",
          disabled: true,
          readOnly: true,
          style: {
            backgroundColor: "lightgray"
          },
          value: [...($[e].joins || []).map(e => G[e]), G[e]].join("+").toUpperCase()
        }));
      }
    })), i.default.createElement(x.default, {
      heading: "Playback Camera",
      Icon: f.Camera.Icon
    }, i.default.createElement(b.default, {
      label: "Zoom",
      value: this.state.playbackZoom,
      onChange: e => this.setState({
        playbackZoom: e.target.value
      }),
      onBlur: () => {
        const e = Math.log2(V);
        const t = parseFloat(this.state.playbackZoom);
        if (isFinite(t)) {
          s(2 ** t);
        } else {
          this.setState({
            playbackZoom: e
          });
        }
      },
      margin: "normal"
    }), i.default.createElement(b.default, {
      label: "Viewport Width",
      value: this.state.playbackWidth,
      onChange: e => this.setState({
        playbackWidth: e.target.value
      }),
      onBlur: () => {
        const e = parseInt(this.state.playbackWidth);
        if (isFinite(e) && e > 0) {
          const t = this.state.playbackHeight;
          if (t !== "") {
            a({
              width: e,
              height: parseInt(t)
            });
          }
        } else {
          a(null);
        }
      },
      margin: "normal"
    }), i.default.createElement(b.default, {
      label: "Viewport Height",
      value: this.state.playbackHeight,
      onChange: e => this.setState({
        playbackHeight: e.target.value
      }),
      onBlur: () => {
        const e = parseInt(this.state.playbackHeight);
        if (isFinite(e) && e > 0) {
          const t = this.state.playbackWidth;
          if (t !== "") {
            a({
              width: parseInt(t),
              height: e
            });
          }
        } else {
          a(null);
        }
      },
      margin: "normal"
    }), i.default.createElement("div", {
      style: {
        display: "flex",
        gap: 4,
        marginTop: 8
      }
    }, i.default.createElement(y.default, {
      raised: true,
      component: "span",
      size: "small",
      onClick: () => this.onSetResolution({
        width: 1280,
        height: 720
      })
    }, "720p"), i.default.createElement(y.default, {
      raised: true,
      component: "span",
      size: "small",
      onClick: () => this.onSetResolution({
        width: 1920,
        height: 1080
      })
    }, "1080p"), i.default.createElement(y.default, {
      raised: true,
      size: "small",
      onClick: () => this.onSetResolution({
        width: 4096,
        height: 2160
      })
    }, "4k")), o && i.default.createElement(i.default.Fragment, null, i.default.createElement(m.FormControlLabel, {
      label: "Show Viewport",
      control: i.default.createElement(M, {
        Component: h.default,
        checked: n.showViewport,
        onChange: () => r("showViewport", !n.showViewport)
      })
    }), i.default.createElement(m.FormControlLabel, {
      label: "Show Visible Areas",
      control: i.default.createElement(M, {
        Component: h.default,
        checked: n.showVisibleAreas,
        onChange: () => r("showVisibleAreas", !n.showVisibleAreas)
      })
    }), i.default.createElement(v.default, {
      type: "caption"
    }, "Showing visible areas might cause performance issues.")))), i.default.createElement(x.default, {
      heading: "Riders",
      Icon: f.FlagVariant.Icon
    }, i.default.createElement("div", null, i.default.createElement(y.default, {
      raised: true,
      component: "span",
      size: "small",
      onClick: this.props.adjustStartPositions
    }, "Move Start Position")), i.default.createElement("div", null, i.default.createElement(m.FormControl, {
      style: {
        minWidth: 130,
        marginTop: 24
      }
    }, i.default.createElement(w.InputLabel, null, "Number of Riders"), i.default.createElement(M, {
      Component: _.default,
      native: true,
      value: this.props.numRiders,
      onChange: e => this.props.setNumRiders(e.currentTarget.value)
    }, i.default.createElement("option", {
      value: 1
    }, "1"), i.default.createElement("option", {
      value: 2
    }, "2"), i.default.createElement("option", {
      value: 3
    }, "3"), i.default.createElement("option", {
      value: 4
    }, "4"), i.default.createElement("option", {
      value: 5
    }, "5"), i.default.createElement("option", {
      value: 6
    }, "6")))), i.default.createElement("div", null, i.default.createElement(m.FormControl, {
      style: {
        marginTop: 24
      }
    }, i.default.createElement(m.FormLabel, null, "Playback Camera Focus"), i.default.createElement("div", null, Array(this.props.numRiders).fill().map((e, t) => i.default.createElement(M, {
      key: t,
      style: {
        color: O.Colors[t],
        width: 42
      },
      Component: E.default,
      checked: this.props.playbackCameraFocus[t],
      onChange: () => this.props.togglePlaybackFollowerFocus(t)
    }))))), i.default.createElement(m.FormControlLabel, {
      label: "Keep Rider in View While Scrubbing",
      control: i.default.createElement(M, {
        Component: h.default,
        checked: A,
        onChange: () => l("cam.useEditorFollower")
      })
    }), A && this.props.numRiders > 1 && i.default.createElement("div", null, i.default.createElement(m.FormControl, {
      style: {
        marginTop: 24
      }
    }, i.default.createElement(m.FormLabel, null, "Editor Camera Focus"), i.default.createElement("div", null, Array(this.props.numRiders).fill().map((e, t) => i.default.createElement(M, {
      key: t,
      style: {
        color: O.Colors[t],
        width: 42
      },
      Component: k.default,
      checked: t === this.props.editorFollowerFocus,
      name: "editor-camera-focus",
      onChange: () => this.props.setEditorFollowerFocus(t)
    })))))), i.default.createElement(x.default, {
      heading: "Audio",
      Icon: f.Audio.Icon
    }, j.loadingFile && i.default.createElement(v.default, {
      type: "body1"
    }, "Loading audio..."), j.error && i.default.createElement(v.default, {
      type: "body1"
    }, "Error loading audio: ", j.error), N.name && i.default.createElement(i.default.Fragment, null, i.default.createElement(v.default, {
      type: "body1"
    }, N.name), i.default.createElement(m.FormControlLabel, {
      label: "Enabled",
      control: i.default.createElement(M, {
        Component: h.default,
        checked: N.enabled,
        onChange: U
      })
    }), i.default.createElement("div", null, i.default.createElement(v.default, null, "Volume"), i.default.createElement("input", {
      type: "range",
      value: N.volume,
      min: 0,
      max: 1,
      step: "any",
      onChange: e => {
        z(parseFloat(e.currentTarget.value));
      },
      onFocus: e => {
        e.currentTarget.blur();
      }
    })), i.default.createElement(b.default, {
      label: "Start Time (seconds)",
      defaultValue: (-N.offset).toString(),
      onBlur: e => {
        const t = -N.offset;
        const n = parseFloat(e.target.value);
        if (isFinite(n)) {
          e.target.value = n;
          F(-n);
        } else {
          e.target.value = t;
        }
      },
      margin: "normal"
    }), false), i.default.createElement("div", null, i.default.createElement("input", {
      onChange: this.onAudioFileInput,
      type: "file",
      accept: "audio/*",
      id: "load-audio-file",
      className: Z.audioInput
    }), i.default.createElement("label", {
      htmlFor: "load-audio-file"
    }, i.default.createElement(g.default, {
      title: "Or drag and drop",
      placement: "right"
    }, i.default.createElement(y.default, {
      raised: true,
      component: "span",
      size: "small"
    }, "Load Audio"))), N.name && i.default.createElement(y.default, {
      component: "span",
      size: "small",
      onClick: H
    }, "Remove Audio"))), t && i.default.createElement(x.default, {
      heading: "Advanced",
      Icon: f.Alert.Icon
    }, i.default.createElement(v.default, {
      type: "caption"
    }, "Modifying these settings may result in unstable behavior."), i.default.createElement(b.default, {
      style: {
        width: "100%"
      },
      label: "Max Duration (minutes)",
      defaultValue: (Math.round(p / 60 / d * 1000) / 1000).toString(),
      onBlur: e => {
        const t = p / 60 / d;
        const n = parseFloat(e.target.value);
        if (isFinite(n)) {
          e.target.value = n;
          B({
            maxDuration: Math.round(n * 60 * d)
          });
        } else {
          e.target.value = t;
        }
      },
      margin: "normal"
    }), i.default.createElement(m.FormControlLabel, {
      label: "Mods Enabled",
      control: i.default.createElement(M, {
        Component: h.default,
        checked: X,
        onChange: () => this.onToggleMods(X)
      })
    }), i.default.createElement(v.default, {
      type: "caption"
    }, "ONLY RUN SCRIPTS FROM TRUSTED SOURCES!"), i.default.createElement("div", null, i.default.createElement("textarea", {
      spellCheck: false,
      className: Z.script,
      defaultValue: W,
      onFocus: e => {
        const t = e.target;
        this.blurOnClick = e => {
          if (e.target !== t) {
            t.blur();
            window.removeEventListener("pointerdown", this.blurOnClick);
          }
        };
        window.addEventListener("pointerdown", this.blurOnClick);
      },
      onBlur: e => {
        q(e.target.value);
        window.removeEventListener("pointerdown", this.blurOnClick);
      },
      onKeyDown: e => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          q(e.target.value);
          this.setState({
            scriptResult: D(e.target.value)
          });
        }
        if (e.key === "Escape") {
          e.target.blur();
        }
        if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
        }
      }
    }), i.default.createElement(g.default, {
      title: (/Mac|iPod|iPhone|iPad/.test(navigator.platform) ? "cmd" : "ctrl") + "+enter",
      placement: "right"
    }, i.default.createElement(y.default, {
      raised: true,
      component: "span",
      size: "small",
      onClick: e => {
        e.target.blur();
        this.setState({
          scriptResult: D(W)
        });
      }
    }, "Run Script")), this.state.scriptResult && i.default.createElement("div", null, i.default.createElement(v.default, {
      type: "caption"
    }, "Error! See console for details."), i.default.createElement("code", null, this.state.scriptResult.message)))), false);
  }
}));
module.exports = exports.default;