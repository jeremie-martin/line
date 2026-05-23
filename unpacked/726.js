Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = h(require("./0.js"));
var i = h(require("./82.js"));
var o = require("./15.js");
var a = require("./17.js");
var s = require("./59.js");
var l = h(require("./88.js"));
var u = require("./48.js");
var c = require("./8.js");
var d = h(require("./728.js"));
var f = h(require("./800.js"));
var p = require("./208.js");
function h(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const m = (0, s.createMuiTheme)({
  typography: {
    fontFamily: "\"Lato\", \"Helvetica\", \"Arial\", sans-serif"
  },
  palette: {
    primary: {
      light: u.blue[300],
      main: u.blue[500],
      dark: u.blue[700]
    },
    secondary: {
      light: u.green[300],
      main: u.green[500],
      dark: u.green[700]
    },
    error: {
      light: u.red[300],
      main: u.red[500],
      dark: u.red[700]
    },
    action: {
      active: "rgba(0, 0, 0, 0.87)"
    }
  }
});
const y = (0, a.createStructuredSelector)({
  inTrialMode: e => e.license.trial,
  views: c.getViews
});
const g = {
  pointerEvents: "none",
  position: "absolute",
  bottom: 0,
  left: 2
};
exports.default = (0, o.connect)(y)(class extends r.default.Component {
  constructor(e) {
    super(e);
    this.state = {
      error: false
    };
  }
  componentDidCatch(e, t) {
    this.setState({
      error: e
    });
    i.default.captureException(e);
  }
  render() {
    if (this.state.error) {
      return r.default.createElement(s.MuiThemeProvider, {
        theme: m
      }, r.default.createElement("div", {
        style: {
          margin: 16
        }
      }, r.default.createElement(l.default, {
        gutterBottom: true,
        type: "display3"
      }, "An error occured!"), r.default.createElement(l.default, {
        gutterBottom: true
      }, "The error has been automatically reported. If you were editing a track, your work has been autosaved, and you can refresh the page to continue."), r.default.createElement("pre", null, this.state.error.name, ": ", this.state.error.message)));
    }
    var e = this.props;
    let t = e.inTrialMode;
    let n = e.views;
    return r.default.createElement(s.MuiThemeProvider, {
      theme: m
    }, r.default.createElement(f.default, {
      views: n
    }), r.default.createElement(d.default, null), t && r.default.createElement(l.default, {
      type: "caption",
      style: g
    }, "Trial Mode: Track duration limited to ", p.TRIAL_DURATION, " seconds"));
  }
});
module.exports = exports.default;