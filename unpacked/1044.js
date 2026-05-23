Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = v(require("./0.js"));
var i = v(require("./5.js"));
var o = v(require("./2.js"));
var a = v(require("./19.js"));
var s = v(require("./177.js"));
var l = v(require("./60.js"));
var u = v(require("./176.js"));
var c = require("./46.js");
var d = require("./130.js");
var f = v(d);
var p = v(require("./98.js"));
var h = v(require("./364.js"));
var m = v(require("./90.js"));
var y = v(require("./299.js"));
var g = require("./168.js");
function v(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const w = {
  Config: "Render",
  Rendering: "Stop",
  Postrender: "Discard"
};
exports.default = (0, o.default)(e => ({
  row: {
    display: "flex",
    justifyContent: "space-between"
  },
  textField: {
    display: "block"
  },
  formControl: {
    display: "block"
  },
  group: {
    margin: `${e.spacing.unit}px 0`
  },
  buttonRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  content: {
    marginTop: e.spacing.unit * 2
  },
  spacer: {
    flex: 1
  },
  displayContainer: {
    marginLeft: e.spacing.unit * 2,
    position: "relative",
    flex: 1
  },
  display: {
    border: `1px solid ${e.palette.divider}`
  },
  video: {
    width: "100%"
  },
  radio: {
    height: 36
  }
}))(class extends r.default.PureComponent {
  constructor(e) {
    super(e);
    this.state = {
      status: "Loading",
      index: 0,
      hq: false,
      resolutionWidth: 1280,
      resolutionHeight: 720,
      resolutionOption: "720p",
      startFrom: "Beginning",
      exportPng: false
    };
    (window.encoderSettings = {}, Object.defineProperty(window.encoderSettings, "help", {
      enumerable: false,
      get() {
        console.log("Please see https://github.com/TrevorSundberg/h264-mp4-encoder#api\n\nRelevant fields are: kbps, speed, quantizationParameter, groupOfPictures\n      ");
      }
    }), new Promise((e, t) => {
      if (window.HME) {
        e(window.HME);
      } else {
        var n = document.head;
        var r = document.createElement("script");
        r.type = "text/javascript";
        r.src = "https://unpkg.com/h264-mp4-encoder@1.0.12/embuild/dist/h264-mp4-encoder.web.js";
        r.onload = () => e(window.HME);
        r.onerror = r.onabort = () => t();
        n.appendChild(r);
      }
    })).then(e => {
      this.HME = e;
      this.setState({
        status: "Config"
      });
    }).catch(() => {
      this.setState({
        status: "LoadError"
      });
    });
    this.cameraFollower = new y.default({
      focus: e.cameraFocus
    });
    if (this.cameraFollower.isFixed()) {
      this.cameraFollower = null;
    }
    const t = e => t => {
      const n = parseInt(t.target.value, 10);
      if (n > 0) {
        this.setState({
          [e]: n
        });
      }
    };
    this.onResolutionOptionChange = e => {
      const t = e.target.value;
      this.setState({
        resolutionOption: t
      });
      switch (t) {
        case "720p":
          this.setState({
            resolutionWidth: 1280,
            resolutionHeight: 720
          });
          break;
        case "1080p":
          this.setState({
            resolutionWidth: 1920,
            resolutionHeight: 1080
          });
      }
    };
    this.onStartFromChange = e => {
      const t = e.target.value;
      this.setState({
        startFrom: t,
        index: t === "Checkpoint" ? this.props.flagIndex : 0
      });
    };
    this.onResolutionWidthChange = t("resolutionWidth");
    this.onResolutionHeightChange = t("resolutionHeight");
    this.onHQChange = e => {
      this.setState(e => ({
        hq: !e.hq
      }));
    };
    this.onDisplayMount = e => {
      this.canvas = e;
    };
    let n = false;
    this.onRenderButtonClick = () => {
      switch (this.state.status) {
        case "Config":
          {
            const e = this.props.frameRateSetting;
            const t = e === true ? 60 : e === false ? this.props.fps : e;
            n = false;
            this.setState({
              status: "Rendering"
            });
            const r = this.state.index;
            let i;
            if (window.timeRemapper) {
              i = window.timeRemapper.physicsToReal(r / this.props.fps);
            }
            let o = 0;
            const a = () => {
              if (n || this.state.index > this.props.maxIndex) {
                return true;
              }
              let a = o++;
              if (e !== false && (a *= this.props.fps / t, window.timeRemapper)) {
                const e = i + a / this.props.fps;
                a = window.timeRemapper.realToPhysics(e) * this.props.fps - r;
              }
              this.setState({
                index: r + a
              });
              return false;
            };
            (async () => {
              const e = {
                gl: this.canvas.getContext("webgl")
              };
              const n = g.WebGL1Renderer.prototype.makeArrayBuffer.call(e);
              const r = g.WebGL1Renderer.prototype.makeArrayBuffer.call(e);
              const i = await this.HME.createH264MP4Encoder();
              i.width = this.state.resolutionWidth;
              i.height = this.state.resolutionHeight;
              i.frameRate = t;
              i.quantizationParameter = this.state.hq ? 22 : 28;
              i.groupOfPictures = 1;
              for (let t in window.encoderSettings) {
                i[t] = window.encoderSettings[t];
              }
              i.initialize();
              for (let t = false; !t; t = a()) {
                g.WebGL1Renderer.prototype.getPixels.call(e, n, r);
                i.addFrameRgba(n);
                await new Promise(requestAnimationFrame);
              }
              i.finalize();
              const o = i.FS.readFile(i.outputFilename);
              i.delete();
              const s = new Blob([o], {
                type: "video/mp4"
              });
              this.onSave = () => {
                this.props.onSave(s);
              };
              this.setState({
                status: "Postrender",
                videoUrl: URL.createObjectURL(s)
              });
            })();
            break;
          }
        case "Rendering":
          n = true;
          break;
        case "Postrender":
          this.onSave = null;
          URL.revokeObjectURL(this.state.videoUrl);
          this.setState(e => ({
            status: "Config",
            index: e.startFrom === "Checkpoint" ? this.props.flagIndex : 0
          }));
      }
    };
  }
  componentWillUnmount() {
    URL.revokeObjectURL(this.state.videoUrl);
  }
  render() {
    return r.default.createElement(p.default, {
      title: "Export Video",
      onRequestClose: this.props.onClose,
      closeDisabled: this.state.status === "Rendering"
    }, this.renderContents());
  }
  renderContents() {
    let e = this.props.classes;
    if (!this.props.hardwareAcceleration) {
      return r.default.createElement(r.default.Fragment, null, r.default.createElement("div", {
        className: e.content
      }, r.default.createElement(a.default, {
        paragraph: true
      }, "This device might not support video export due to an unsupported graphics card."), r.default.createElement(a.default, {
        paragraph: true
      }, r.default.createElement("a", {
        href: "https://www.linerider.com/?forceMillions"
      }, "Try force enabling the graphics card"))), r.default.createElement("div", {
        className: e.spacer
      }));
    }
    var t = this.props;
    let n = t.track;
    let o = t.zoom;
    var p = this.state;
    const y = p.status;
    const g = p.hq;
    const v = p.resolutionWidth;
    const x = p.resolutionHeight;
    const E = p.resolutionOption;
    const S = p.startFrom;
    const T = p.index;
    if (y === "Loading") {
      return r.default.createElement(r.default.Fragment, null, r.default.createElement("div", {
        className: e.content
      }, r.default.createElement(a.default, null, "Loading video encoder...")), r.default.createElement("div", {
        className: e.spacer
      }));
    }
    if (y === "LoadError") {
      return r.default.createElement(r.default.Fragment, null, r.default.createElement("div", {
        className: e.content
      }, r.default.createElement(a.default, null, "Video encoder was not able to be loaded (are you connected to the internet?)")), r.default.createElement("div", {
        className: e.spacer
      }));
    }
    let k = 1;
    let O = x / v;
    if (O > 1) {
      k = 1 / O;
      O = 1;
    }
    const P = y !== "Config";
    const C = P || E !== "Custom";
    const I = {
      width: v,
      height: x
    };
    o = window.getAutoZoom ? window.getAutoZoom(T) : o;
    const M = {
      position: this.cameraFollower ? this.cameraFollower.getCamera(n, Object.assign({
        zoom: o
      }, I), T) : this.props.pan,
      zoom: o
    };
    const L = S === "Checkpoint" ? this.props.flagIndex : 0;
    let R = null;
    if (y === "Rendering") {
      R = (T - L) * 100 / (this.props.maxIndex - L);
    }
    if (R === 100) {
      R = true;
    }
    const A = {
      width: "100%",
      maxWidth: Math.min(300, k * 300 / O),
      maxHeight: Math.min(300, 300 / k * O)
    };
    return r.default.createElement(r.default.Fragment, null, r.default.createElement("div", {
      className: (0, i.default)(e.content, e.row)
    }, r.default.createElement("div", null, r.default.createElement(c.FormControl, {
      className: e.formControl,
      disabled: P
    }, r.default.createElement(c.FormLabel, null, "Start From"), r.default.createElement(d.RadioGroup, {
      className: e.group,
      value: S,
      onChange: this.onStartFromChange
    }, ["Beginning", "Checkpoint"].map(t => r.default.createElement(c.FormControlLabel, {
      key: t,
      value: t,
      control: r.default.createElement(f.default, {
        className: e.radio
      }),
      label: t
    })))), r.default.createElement(c.FormControl, {
      className: e.formControl,
      disabled: P
    }, r.default.createElement(c.FormLabel, null, "Resolution"), r.default.createElement(d.RadioGroup, {
      className: e.group,
      value: E,
      onChange: this.onResolutionOptionChange
    }, r.default.createElement(c.FormControlLabel, {
      value: "720p",
      control: r.default.createElement(f.default, {
        className: e.radio
      }),
      label: "720p"
    }), r.default.createElement(c.FormControlLabel, {
      value: "1080p",
      control: r.default.createElement(f.default, {
        className: e.radio
      }),
      label: "1080p"
    }), r.default.createElement(c.FormControlLabel, {
      value: "Custom",
      control: r.default.createElement(f.default, {
        className: e.radio
      }),
      label: "Custom"
    }))), r.default.createElement(c.FormControlLabel, {
      label: "High Quality",
      control: r.default.createElement(u.default, {
        disabled: P,
        checked: g,
        onChange: this.onHQChange
      })
    })), r.default.createElement("div", {
      className: e.displayContainer
    }, y === "Postrender" ? r.default.createElement("video", {
      className: e.video,
      style: A,
      src: this.state.videoUrl,
      controls: true
    }) : r.default.createElement(h.default, {
      secondary: true,
      innerRef: this.onDisplayMount,
      className: e.display,
      style: A,
      pixelRatio: 1,
      dimensions: I,
      index: T,
      camera: M,
      preview: true
    }), r.default.createElement("div", {
      style: {
        display: "flex"
      }
    }, r.default.createElement(s.default, {
      className: e.textField,
      disabled: C,
      label: "Width",
      value: v,
      onChange: this.onResolutionWidthChange,
      margin: "normal"
    }), r.default.createElement(s.default, {
      className: e.textField,
      disabled: C,
      label: "Height",
      value: x,
      onChange: this.onResolutionHeightChange,
      margin: "normal"
    })))), r.default.createElement(a.default, {
      type: "caption"
    }, this.props.audioEnabled && "Video export is currently unable to export with audio."), r.default.createElement("div", {
      className: e.spacer
    }), r.default.createElement("div", {
      className: e.content
    }, r.default.createElement(m.default, {
      progress: {
        status: "Rendering...",
        percent: R
      }
    }), r.default.createElement("div", {
      className: e.buttonRow
    }, r.default.createElement(l.default, {
      raised: true,
      onClick: this.onRenderButtonClick
    }, w[y]), r.default.createElement(l.default, {
      raised: true,
      color: "primary",
      disabled: y !== "Postrender",
      onClick: this.onSave
    }, "Save"))));
  }
});
module.exports = exports.default;