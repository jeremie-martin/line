Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = f(require("./0.js"));
var i = require("./15.js");
var o = require("./17.js");
var a = f(require("./19.js"));
var s = require("./8.js");
var l = f(require("./132.js"));
var u = require("./22.js");
var c = f(require("./256.js"));
var d = f(require("./1019.js"));
function f(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const p = (0, o.createStructuredSelector)({
  track: s.getTrackDetailsWithCloudInfo,
  dirty: s.getTrackIsDirty,
  shareLinks: s.getTrackShareLinks
});
exports.default = (0, i.connect)(p)(class extends r.default.PureComponent {
  renderLink(e) {
    if (this.props.track.cloudInfo) {
      if (this.props.dirty) {
        return r.default.createElement(a.default, null, "This track has unsaved changes that need to be saved to have share links.");
      } else {
        return e;
      }
    } else {
      return r.default.createElement(a.default, null, "This track needs to be saved to the server to have share links.");
    }
  }
  render() {
    var e = this.props;
    let t = e.track;
    let n = e.shareLinks;
    return r.default.createElement("div", null, r.default.createElement(l.default, {
      heading: "Track Info",
      Icon: u.Information.Icon
    }, r.default.createElement(c.default, {
      track: t
    })), r.default.createElement(l.default, {
      heading: "View Only",
      Icon: u.Play.Icon,
      defaultExpanded: true
    }, this.renderLink(r.default.createElement(r.default.Fragment, null, r.default.createElement(d.default, {
      type: "view"
    }, n.view), r.default.createElement(a.default, {
      type: "caption"
    }, "This link lets people view this version of your track. They won't be able to edit it or save their own copies.")))), r.default.createElement(l.default, {
      heading: "View & Edit a Copy",
      Icon: u.Pencil.Icon
    }, this.renderLink(r.default.createElement(r.default.Fragment, null, r.default.createElement(d.default, {
      type: "edit"
    }, n.edit), r.default.createElement(a.default, {
      type: "caption"
    }, "This link lets people view this version of your track and edit their own copies. Their copies will include an attribution to your track.")))));
  }
});
module.exports = exports.default;