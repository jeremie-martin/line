Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = x(require("./0.js"));
var i = require("./15.js");
var o = require("./17.js");
var a = require("./8.js");
var s = require("./7.js");
var l = require("./80.js");
var u = w(require("./48.js"));
var c = require("./43.js");
var d = x(require("./123.js"));
var f = x(require("./2.js"));
var p = x(require("./88.js"));
var h = x(require("./391.js"));
var m = w(require("./22.js"));
var y = x(require("./1005.js"));
var g = x(require("./1028.js"));
var v = x(require("./1032.js"));
var b = x(require("./1033.js"));
var _ = x(require("./1035.js"));
function w(e) {
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
}
function x(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const E = {
  [l.Pages.Sidebar.Info]: g.default,
  [l.Pages.Sidebar.Share]: y.default,
  [l.Pages.Sidebar.Settings]: b.default,
  [l.Pages.Sidebar.Help]: v.default,
  [l.Pages.Sidebar.Mods]: _.default
};
const S = {
  enter: c.duration.enteringScreen,
  exit: c.duration.leavingScreen
};
const T = (0, o.createStructuredSelector)({
  page: a.getSidebarPage
});
const k = {
  closeSidebar: s.closeSidebar
};
exports.default = (0, i.connect)(T, k)((0, f.default)(e => ({
  root: {
    overflowY: "auto",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
    position: "absolute",
    paddingLeft: e.spacing.unit * 8,
    paddingTop: e.spacing.unit * 2,
    width: "100%",
    "@media (min-width: 720px) and (min-height: 430px)": {
      maxWidth: 360
    },
    height: "100%",
    backgroundColor: u.overlayBackground,
    borderRight: `1px solid ${e.palette.divider}`
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 24
  },
  pageTitle: {
    paddingLeft: e.spacing.unit * 2,
    "&::first-letter": {
      textTransform: "uppercase"
    }
  },
  divider: {
    marginRight: e.spacing.unit * 2
  },
  content: {
    flex: 1,
    marginRight: e.spacing.unit * 2
  }
}))(class extends r.default.Component {
  constructor(e) {
    super(e);
    this.state = {
      page: e.page
    };
    this.onExited = () => {
      this.setState({
        page: null
      });
    };
  }
  componentWillReceiveProps(e) {
    if (e.page && e.page !== this.state.page) {
      this.setState({
        page: e.page
      });
    }
  }
  render() {
    var e = this.props;
    let t = e.classes;
    let n = e.closeSidebar;
    if (!this.state.page) {
      return r.default.createElement("div", null);
    }
    let i = E[this.state.page];
    return r.default.createElement(d.default, {
      in: !!this.props.page,
      direction: "right",
      timeout: S,
      onExited: this.onExited
    }, r.default.createElement("div", {
      className: t.root,
      style: {
        display: this.props.visible ? "initial" : "none"
      }
    }, r.default.createElement(p.default, {
      className: t.pageTitle,
      type: "display1",
      gutterBottom: true
    }, this.state.page), r.default.createElement(m.ChevronLeft.Button, {
      className: t.closeButton,
      onClick: n
    }), this.props.headerChildren, r.default.createElement(h.default, {
      className: t.divider
    }), r.default.createElement("div", {
      className: t.content
    }, r.default.createElement(i, {
      requestClose: n
    }))));
  }
}));
module.exports = exports.default;