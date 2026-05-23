Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = f(require("./0.js"));
var i = f(require("./180.js"));
var o = require("./15.js");
var a = f(require("./2.js"));
var s = f(require("./19.js"));
var l = require("./258.js");
var u = f(require("./98.js"));
var c = require("./26.js");
var d = f(require("./147.js"));
function f(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const p = {
  onClose: require("./7.js").closeAboutPage
};
exports.default = (0, o.connect)(null, p)((0, a.default)(e => ({
  container: {
    overflowY: "hidden"
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
      contents: null
    };
  }
  async fetchContents() {
    const e = await (0, c.fetchTextResource)((0, d.default)("about.md"));
    if (this.mounted) {
      this.setState({
        contents: e
      });
    }
  }
  componentDidMount() {
    this.mounted = true;
    this.fetchContents();
  }
  componentWillUnmount() {
    this.mounted = false;
  }
  render() {
    var e = this.props;
    let t = e.onClose;
    let n = e.classes;
    return r.default.createElement(u.default, {
      title: "About",
      onRequestClose: t,
      scrollable: true
    }, r.default.createElement("div", {
      className: n.container
    }, r.default.createElement("div", {
      className: n.content
    }, this.state.contents ? r.default.createElement(s.default, {
      dangerouslySetInnerHTML: {
        __html: (0, i.default)(this.state.contents, {
          renderer: l.renderer,
          breaks: true,
          sanitize: true
        })
      }
    }) : r.default.createElement(s.default, null, "Loading..."))), r.default.createElement("div", {
      className: n.spacer
    }));
  }
}));
module.exports = exports.default;