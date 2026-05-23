Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = b(require("./0.js"));
var i = b(require("./2.js"));
var o = b(require("./19.js"));
var a = b(require("./60.js"));
var s = require("./38.js");
var l = b(s);
var u = require("./74.js");
var c = b(u);
var d = b(require("./95.js"));
var f = require("./411.js");
var p = require("./7.js");
var h = b(require("./98.js"));
var m = b(require("./90.js"));
var y = b(require("./256.js"));
var g = function (e) {
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
var v = b(require("./1040.js"));
function b(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = (0, i.default)(e => ({
  listInfoContainer: {
    flex: "1 1 auto",
    height: 0,
    display: "flex",
    alignItems: "stretch",
    "& > *": {
      flex: "1 1 50%",
      overflowY: "auto",
      borderBottom: `1px solid ${e.palette.divider}`
    },
    "@media (max-width: 600px) and (orientation: portrait)": {
      flexDirection: "column"
    }
  },
  list: {
    overflowWrap: "break-word",
    overflowX: "hidden"
  },
  info: {
    position: "relative",
    padding: e.spacing.unit * 2
  },
  noSavedTracks: {
    padding: e.spacing.unit * 2,
    flex: 1
  },
  listItemSelected: {
    backgroundColor: e.palette.action.selected,
    "@media (hover: none)": {
      "&:hover": {
        backgroundColor: e.palette.action.selected
      }
    }
  },
  content: {
    marginTop: e.spacing.unit * 2
  },
  buttonRow: {
    display: "flex",
    justifyContent: "space-between"
  },
  menuButton: {
    position: "absolute",
    top: 8,
    right: 8
  }
}))(class extends r.default.PureComponent {
  constructor(e) {
    super(e);
    this.state = {
      menuAnchorEl: null,
      menuOpen: false,
      selectedIndex: null
    };
    this.onDropzoneRef = e => {
      this.dropzone = e;
    };
    this.onClickLoadFromFile = () => this.dropzone.open();
    this.onMenuOpen = e => {
      this.setState({
        menuOpen: true,
        menuAnchorEl: e.currentTarget
      });
    };
    this.onMenuClose = () => this.setState({
      menuOpen: false
    });
    this.onSelectTrack = e => {
      this.setState({
        selectedIndex: e.currentTarget.value
      });
    };
    this.onLoad = () => {
      this.props.onLoadTrack(this.props.tracks[this.state.selectedIndex]);
    };
    this.onRemove = () => {
      this.onMenuClose();
      this.props.onRemoveTrack(this.props.tracks[this.state.selectedIndex]);
      this.setState({
        selectedIndex: null
      });
    };
  }
  render() {
    var e = this.props;
    let t = e.onLoadFile;
    let n = e.disabled;
    let i = e.tracks;
    let b = e.onClose;
    let _ = e.classes;
    var w = this.state;
    let x = w.menuAnchorEl;
    let E = w.menuOpen;
    let S = w.selectedIndex;
    let T = i && i[S];
    let k = r.default.createElement(a.default, {
      raised: true,
      onClick: this.onClickLoadFromFile,
      disabled: n
    }, "Load From File");
    if (!n) {
      k = r.default.createElement(d.default, {
        title: "Or drag and drop",
        placement: "right"
      }, k);
    }
    return r.default.createElement(v.default, {
      innerRef: this.onDropzoneRef,
      onFileDrop: t
    }, r.default.createElement(h.default, {
      title: "Load Track",
      onRequestClose: b,
      closeDisabled: n
    }, i ? i.length === 0 ? r.default.createElement("div", {
      className: _.noSavedTracks
    }, r.default.createElement(o.default, null, "No Saved Tracks")) : r.default.createElement("div", {
      className: _.listInfoContainer
    }, r.default.createElement(l.default, {
      className: _.list
    }, i.map((e, t) => r.default.createElement(s.ListItem, {
      component: "button",
      disabled: n,
      key: t,
      value: t,
      className: t === S ? _.listItemSelected : "",
      button: true,
      onClick: this.onSelectTrack
    }, r.default.createElement(s.ListItemText, {
      primary: e.details.title,
      secondary: (0, f.getFormattedDateTime)(e.cloudInfo.saveTime)
    })))), r.default.createElement("div", {
      className: _.info
    }, T ? r.default.createElement(r.default.Fragment, null, r.default.createElement(y.default, {
      track: T
    }), r.default.createElement(g.DotsVertical.Button, {
      onClick: this.onMenuOpen,
      className: _.menuButton,
      disabled: n
    }), r.default.createElement(c.default, {
      open: E,
      anchorEl: x,
      onClose: this.onMenuClose
    }, r.default.createElement(u.MenuItem, {
      onClick: this.onRemove
    }, "Remove"))) : r.default.createElement(o.default, null, "Select track..."))) : r.default.createElement("div", {
      className: _.noSavedTracks
    }, r.default.createElement(o.default, null, "Saved tracks unavailable.")), r.default.createElement("div", {
      className: _.content
    }, r.default.createElement(m.default, {
      id: p.LOAD_TRACK
    }), r.default.createElement("div", {
      className: _.buttonRow
    }, k, false, r.default.createElement(a.default, {
      raised: true,
      color: "primary",
      onClick: this.onLoad,
      disabled: !T || n
    }, "Load")))));
  }
});
module.exports = exports.default;