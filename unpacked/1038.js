Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = d(require("./0.js"));
var i = require("./15.js");
var o = require("./17.js");
var a = require("./112.js");
var s = require("./7.js");
var l = require("./149.js");
var u = require("./214.js");
var c = d(require("./1039.js"));
function d(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const f = (0, o.createStructuredSelector)({
  tracks: a.getSavedTracks
});
const p = {
  analyticsLoadTrackFile: u.analyticsLoadTrackFile,
  analyticsLoadTrack: u.analyticsLoadTrack,
  loadTrackFromServer: l.loadTrackFromServer,
  loadTrackFile: l.loadTrackFile,
  onRemoveTrack: l.removeTrack,
  switchFromTrackLoaderToEditor: s.switchFromTrackLoaderToEditor,
  onClose: s.closeTrackLoader
};
exports.default = (0, i.connect)(f, p)(class extends r.default.Component {
  constructor(e) {
    super(e);
    this.state = {
      disabled: false
    };
    this.onLoadFile = e => {
      this.setState({
        disabled: true
      });
      this.props.analyticsLoadTrackFile();
      this.props.loadTrackFile(e).then(t);
    };
    this.onLoadTrack = e => {
      this.setState({
        disabled: true
      });
      this.props.analyticsLoadTrack();
      this.props.loadTrackFromServer(e).then(t);
    };
    const t = e => {
      if (e) {
        this.props.switchFromTrackLoaderToEditor();
      } else {
        this.setState({
          disabled: false
        });
      }
    };
  }
  render() {
    var e = this.props;
    let t = e.tracks;
    let n = e.onClose;
    let i = e.onRemoveTrack;
    return r.default.createElement(c.default, {
      disabled: this.state.disabled,
      tracks: t,
      onClose: n,
      onRemoveTrack: i,
      onLoadFile: this.onLoadFile,
      onLoadTrack: this.onLoadTrack
    });
  }
});
module.exports = exports.default;