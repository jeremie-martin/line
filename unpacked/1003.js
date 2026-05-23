Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = c(require("./0.js"));
var i = c(require("./2.js"));
var o = c(require("./68.js"));
var a = require("./17.js");
var s = require("./15.js");
var l = require("./8.js");
var u = require("./7.js");
function c(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const d = (0, a.createStructuredSelector)({
  enabledSettings: l.getEnabledSettings,
  enabledTools: l.getEnabledTools,
  activeTool: l.getSelectedTool
});
const f = {
  setTool: u.setTool
};
class p extends r.default.Component {
  constructor(e) {
    super(e);
    this.state = {
      hasError: false
    };
  }
  componentDidCatch() {
    this.setState({
      hasError: true
    });
  }
  render() {
    if (this.state.hasError) {
      return null;
    } else {
      return this.props.children;
    }
  }
}
exports.default = (0, s.connect)(d, f)((0, i.default)({
  root: {
    borderRadius: "10px",
    display: "flex",
    flexDirection: "column",
    height: "35vh",
    overflow: "hidden"
  },
  toolbar: {
    alignItems: "center",
    display: "flex",
    flexDirection: "row"
  },
  searchBox: {
    background: "none",
    border: "none",
    marginLeft: "1em",
    width: "100%"
  },
  modContainer: {
    display: "flex",
    flexDirection: "column-reverse",
    height: "100%",
    overflowY: "scroll",
    textAlign: "right"
  }
})(class extends r.default.PureComponent {
  constructor(e) {
    super(e);
    this.state = {
      searchTerm: ""
    };
  }
  setToolButtons(e) {
    this.toolButtons = Object.keys(e).map(e => ({
      component: () => r.default.createElement(r.default.Fragment, null, r.default.createElement("button", {
        key: e,
        style: {
          backgroundColor: this.props.activeTool === e ? "lightblue" : null
        },
        onClick: () => this.props.setTool(e)
      }, e), this.props.activeTool === e && r.default.createElement(this.props.enabledTools[e].component)),
      name: e
    }));
  }
  componentWillMount() {
    this.setToolButtons(this.props.enabledTools);
  }
  render() {
    var e = this.props;
    let t = e.classes;
    let n = e.enabledSettings;
    if (Object.keys(this.props.enabledTools).length !== this.toolButtons.length) {
      this.setToolButtons(this.props.enabledTools);
    }
    const i = n.map(e => ({
      component: e,
      name: e.name
    }));
    i.reverse();
    const a = i.concat(this.toolButtons).filter(e => e.name.toUpperCase().includes(this.state.searchTerm.toUpperCase()));
    return r.default.createElement(o.default, {
      anchor: "bottomRight",
      vertical: true,
      style: {
        marginBottom: "70px"
      }
    }, r.default.createElement("div", {
      className: t.root
    }, r.default.createElement("div", {
      className: t.toolbar
    }, r.default.createElement("input", {
      className: t.searchBox,
      placeholder: "Search...",
      value: this.state.searchTerm,
      onChange: e => this.setState({
        searchTerm: e.target.value
      })
    })), r.default.createElement("div", {
      className: t.modContainer
    }, a.map(e => r.default.createElement(p, {
      key: e.name
    }, r.default.createElement(e.component))))));
  }
}));
module.exports = exports.default;