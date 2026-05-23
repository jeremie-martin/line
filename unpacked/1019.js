Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = f(require("./0.js"));
var i = f(require("./21.js"));
var o = require("./15.js");
var a = f(require("./1020.js"));
var s = f(require("./2.js"));
var l = require("./22.js");
var u = f(require("./88.js"));
var c = require("./125.js");
var d = f(require("./95.js"));
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
  analyticsCopyLink: require("./214.js").analyticsCopyLink
};
exports.default = (0, o.connect)(null, p)((0, s.default)(e => ({
  root: {
    display: "flex",
    height: 38,
    borderRadius: 2,
    border: `1px solid ${e.palette.divider}`,
    marginBottom: e.spacing.unit * 2
  },
  icon: {
    transform: "scale(0.75)"
  },
  button: {
    width: 36,
    height: 36
  },
  inputContainer: {
    display: "initial",
    flex: 1
  },
  input: {
    width: "100%",
    border: "none",
    borderLeft: `1px solid ${e.palette.divider}`,
    height: 36,
    padding: e.spacing.unit,
    background: "initial"
  }
}))(class extends r.default.PureComponent {
  constructor(e) {
    super(e);
    this.state = {
      open: false
    };
    this.onInputRef = e => {
      this.inputRef = e;
    };
    this.onButtonRef = e => {
      this.buttonRef = e;
    };
    this.onInputClicked = () => {
      this.inputRef.select();
      if (this.props.onClick) {
        this.props.onClick();
      }
    };
  }
  componentDidMount() {
    this.clipboard = new a.default(i.default.findDOMNode(this.buttonRef), {
      target: () => i.default.findDOMNode(this.inputRef)
    });
    this.clipboard.on("success", e => {
      this.props.analyticsCopyLink(this.props.type);
      this.setState({
        open: true
      });
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.setState({
        open: false
      }), 1000);
      e.clearSelection();
      if (this.props.onClick) {
        this.props.onClick();
      }
    });
    this.clipboard.on("error", e => {
      console.error("Action:", e.action);
      console.error("Trigger:", e.trigger);
    });
  }
  componentWillUnmount() {
    clearTimeout(this.timer);
    this.clipboard.destroy();
    this.clipboard = null;
    this.inputRef = null;
    this.buttonRef = null;
  }
  render() {
    var e = this.props;
    let t = e.children;
    let n = e.classes;
    return r.default.createElement("div", {
      className: n.root
    }, r.default.createElement(d.default, {
      open: this.state.open,
      title: "Link copied!",
      placement: "right"
    }, r.default.createElement(c.IconButton, {
      className: n.button,
      ref: this.onButtonRef
    }, r.default.createElement(l.Copy.Icon, {
      className: n.icon
    }))), r.default.createElement(u.default, {
      type: "caption",
      className: n.inputContainer
    }, r.default.createElement("input", {
      type: "text",
      readOnly: true,
      className: n.input,
      onClick: this.onInputClicked,
      ref: this.onInputRef,
      value: t
    })));
  }
}));
module.exports = exports.default;