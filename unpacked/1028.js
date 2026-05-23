Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = h(require("./0.js"));
var i = require("./15.js");
var o = require("./17.js");
var a = h(require("./2.js"));
var s = h(require("./19.js"));
var l = require("./8.js");
var u = h(require("./256.js"));
var c = h(require("./132.js"));
var d = require("./259.js");
var f = require("./7.js");
var p = require("./48.js");
function h(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const m = (0, o.createStructuredSelector)({
  track: l.getTrackDetailsWithCloudInfo,
  lineCount: l.getSimulatorLineCount
});
const y = {
  openReleaseNotes: f.openReleaseNotes,
  openAboutPage: f.openAboutPage
};
const g = {
  position: "relative",
  top: 0,
  marginTop: -6,
  display: "inline-block",
  borderRadius: "50%",
  width: 12,
  height: 12
};
const v = {
  root: {},
  colorSwatchBlue: Object.assign({}, g, {
    backgroundColor: p.blue[500]
  }),
  colorSwatchRed: Object.assign({}, g, {
    backgroundColor: p.red[500]
  }),
  colorSwatchGreen: Object.assign({}, g, {
    backgroundColor: p.green[500]
  })
};
exports.default = (0, i.connect)(m, y)((0, a.default)(v)(class extends r.default.Component {
  render() {
    var e = this.props;
    let t = e.classes;
    let n = e.lineCount;
    let i = e.openReleaseNotes;
    let o = e.openAboutPage;
    let a = e.track;
    return r.default.createElement("div", {
      className: t.root
    }, r.default.createElement(c.default, {
      heading: "Track Info",
      defaultExpanded: true
    }, r.default.createElement(u.default, {
      track: a
    }), r.default.createElement(s.default, null, "Line count: ", n.total), r.default.createElement(s.default, {
      component: "span"
    }, r.default.createElement("div", {
      className: t.colorSwatchBlue
    }), " ", n.lineCounts[0] || 0, " "), r.default.createElement(s.default, {
      component: "span"
    }, r.default.createElement("div", {
      className: t.colorSwatchRed
    }), " ", n.lineCounts[1] || 0, " "), r.default.createElement(s.default, {
      component: "span"
    }, r.default.createElement("div", {
      className: t.colorSwatchGreen
    }), " ", n.lineCounts[2] || 0, " ")), r.default.createElement(c.default, {
      heading: "About"
    }, r.default.createElement(d.Version, {
      openReleaseNotes: i
    }), r.default.createElement(d.About, {
      openAboutPage: o
    }), r.default.createElement(d.Copyright, null)));
  }
}));
module.exports = exports.default;