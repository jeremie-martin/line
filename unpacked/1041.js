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
var i = m(require("./0.js"));
var o = require("./15.js");
var a = require("./17.js");
var s = require("./8.js");
var l = require("./7.js");
var u = require("./55.js");
var c = m(require("./1042.js"));
var d = require("./312.js");
var f = require("./151.js");
var p = require("./112.js");
var h = require("./29.js");
function m(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const y = (0, a.createStructuredSelector)({
  forceSaveToFile: e => !(0, p.getSavedTracksAvailable)(e),
  inProgress: f.getTrackSaverInProgress,
  trackDirty: s.getTrackIsDirty,
  localFile: s.getTrackIsLocalFile,
  trackDetails: s.getTrackDetails
});
const g = {
  showNotification: h.showNotification,
  saveTrack: d.saveTrack,
  setLocalFile: u.setLocalFile,
  onClose: l.closeTrackSaver,
  openSidebarSharePage: l.openSidebarSharePage
};
exports.default = (0, o.connect)(y, g)(class extends i.default.Component {
  constructor(e) {
    super(e);
    this.initialProps = {
      trackDirty: e.trackDirty,
      localFile: e.localFile || e.forceSaveToFile,
      trackDetails: e.trackDetails
    };
    this.state = {
      disabled: false
    };
    this.handleSave = (e, t) => {
      this.setState({
        disabled: true
      });
      this.props.setLocalFile(t);
      this.props.saveTrack(e).then(e => {
        if (e) {
          this.props.onClose();
          this.props.showNotification("Save complete.");
        } else {
          this.setState({
            disabled: false
          });
        }
      });
    };
  }
  render() {
    var e = this.props;
    let t = e.forceSaveToFile;
    let n = e.inProgress;
    let o = e.onClose;
    return i.default.createElement(c.default, r({}, this.initialProps, {
      disabled: this.state.disabled,
      forceSaveToFile: t,
      inProgress: n,
      onTrackInfoChange: this.handleTrackInfoChange,
      onToggleSaveToFile: this.handleToggleSaveToFile,
      onClose: o,
      onSave: this.handleSave
    }));
  }
});
module.exports = exports.default;