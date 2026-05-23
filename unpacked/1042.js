Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = p(require("./0.js"));
var i = p(require("./2.js"));
var o = p(require("./19.js"));
var a = p(require("./177.js"));
var s = p(require("./60.js"));
var l = p(require("./389.js"));
var u = require("./46.js");
var c = require("./7.js");
var d = p(require("./98.js"));
var f = p(require("./90.js"));
function p(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = (0, i.default)(e => ({
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
  }
}))(class extends r.default.PureComponent {
  constructor(e) {
    super(e);
    this.state = {
      localFile: true,
      dirty: e.trackDirty,
      trackDetails: {
        title: e.trackDetails.title,
        creator: e.trackDetails.creator,
        description: e.trackDetails.description
      },
      persisted: "unknown"
    };
    const t = t => {
      this.setState({
        persisted: t,
        localFile: t !== true || e.localFile
      });
    };
    if (navigator.storage) {
      if (navigator.storage.persisted) {
        navigator.storage.persisted().then(t);
      }
      if (navigator.storage.persist) {
        navigator.storage.persist().then(t);
      }
    }
    const n = e => t => {
      let n = t.target.value;
      this.setState(t => ({
        dirty: true,
        trackDetails: Object.assign({}, t.trackDetails, {
          [e]: n
        })
      }));
    };
    this.onTrackInfoChange = {
      title: n("title"),
      creator: n("creator"),
      description: n("description")
    };
    this.onToggleSaveToFile = () => {
      this.setState(e => ({
        dirty: true,
        localFile: !e.localFile
      }));
    };
    this.onSave = () => {
      this.props.onSave(this.state.trackDetails, this.state.localFile);
    };
    this.onExport = () => {
      window.exportTrack(this.state.trackDetails);
    };
  }
  render() {
    var e = this.props;
    let t = e.disabled;
    let n = e.forceSaveToFile;
    let i = e.inProgress;
    let p = e.onClose;
    let h = e.classes;
    var m = this.state;
    let y = m.trackDetails;
    let g = m.dirty;
    let v = m.localFile;
    let b = y.title != null && y.title !== "";
    let _ = i ? "Saving" : g ? "Save" : "Saved";
    return r.default.createElement(d.default, {
      title: "Save Track",
      onRequestClose: p,
      closeDisabled: t
    }, r.default.createElement("div", {
      className: h.content
    }, r.default.createElement(a.default, {
      value: y.title,
      onChange: this.onTrackInfoChange.title,
      disabled: t,
      label: "Title",
      autoFocus: true,
      fullWidth: true
    }), r.default.createElement(a.default, {
      value: y.creator,
      onChange: this.onTrackInfoChange.creator,
      disabled: t,
      label: "Creator (optional)",
      margin: "normal",
      fullWidth: true
    }), r.default.createElement(a.default, {
      value: y.description,
      onChange: this.onTrackInfoChange.description,
      disabled: t,
      label: "Description (optional)",
      margin: "normal",
      fullWidth: true,
      multiline: true,
      rowsMax: 8
    })), r.default.createElement("div", {
      className: h.content
    }, r.default.createElement(o.default, {
      type: "caption",
      paragraph: true
    }, "If you are in private browsing or incognito mode, your track will not be saved in the browser, and you should save to file instead!"), r.default.createElement(o.default, {
      type: "caption"
    }, "Persistent browser storage: ", this.state.persisted.toString(), " ", this.state.persisted !== true && "(you should save to file)")), r.default.createElement("div", {
      className: h.spacer
    }), r.default.createElement("div", {
      className: h.content
    }, r.default.createElement(f.default, {
      id: c.SAVE_TRACK
    }), r.default.createElement("div", {
      className: h.buttonRow
    }, r.default.createElement(u.FormControlLabel, {
      control: r.default.createElement(l.default, {
        checked: v,
        onChange: this.onToggleSaveToFile
      }),
      label: "Save to File",
      disabled: t || n
    }), false, r.default.createElement(s.default, {
      onClick: this.onSave,
      color: "primary",
      raised: true,
      disabled: !b || t || !g
    }, _))));
  }
});
module.exports = exports.default;