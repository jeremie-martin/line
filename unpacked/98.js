Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = f(require("./0.js"));
var i = f(require("./5.js"));
var o = f(require("./2.js"));
var a = f(require("./88.js"));
var s = f(require("./249.js"));
var l = f(require("./363.js"));
var u = d(require("./48.js"));
var c = d(require("./22.js"));
function d(e) {
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
function f(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const p = "@media (max-height: 640px), (max-width: 568px)";
exports.default = (0, o.default)(e => ({
  root: {
    position: "fixed",
    width: "100%",
    height: "100%",
    transition: "background-color 300ms ease-in-out"
  },
  container: {
    margin: "0 auto",
    padding: e.spacing.unit * 3,
    width: "100%",
    maxWidth: 700,
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "center",
    [p]: {
      maxWidth: "initial"
    }
  },
  scrollableContainer: {
    height: "100%",
    paddingBottom: 0
  },
  innerContainer: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "center",
    minHeight: 600,
    [p]: {
      minHeight: 0
    }
  },
  innerContainerNoScroll: {
    [p]: {
      minHeight: "initial",
      flex: 1
    }
  },
  closeButton: {
    position: "absolute",
    top: -4,
    right: 0
  }
}))(class extends r.default.PureComponent {
  constructor(e) {
    super(e);
    if (e.onRequestClose) {
      this.onRequestClose = () => {
        if (!this.props.closeDisabled) {
          this.props.onRequestClose();
        }
      };
      this.onKeyDown = e => {
        if ((0, l.default)(e.keyCode) === "escape") {
          this.onRequestClose();
        }
      };
      document.addEventListener("keydown", this.onKeyDown);
    }
  }
  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyDown);
  }
  render() {
    var e = this.props;
    let t = e.title;
    let n = e.children;
    let o = e.onRequestClose;
    let l = e.closeDisabled;
    let d = e.scrollable;
    let f = e.classes;
    let p = u.overlayBackground;
    if (this.props.in === false) {
      p = "rgba(255, 255, 255, 0)";
    }
    let h = "0s";
    if (this.props.delay !== undefined) {
      h = this.props.delay + "ms";
    }
    return r.default.createElement("div", {
      className: f.root,
      style: {
        backgroundColor: p,
        transitionDelay: h
      }
    }, r.default.createElement("div", {
      className: (0, i.default)(f.container, d && f.scrollableContainer)
    }, r.default.createElement("div", {
      className: (0, i.default)(f.innerContainer, !d && f.innerContainerNoScroll)
    }, t && r.default.createElement(r.default.Fragment, null, o && r.default.createElement(c.Close.Button, {
      onClick: o,
      className: f.closeButton,
      disabled: l
    }), r.default.createElement(a.default, {
      type: "display1",
      gutterBottom: true
    }, t), r.default.createElement(s.default, null)), n)));
  }
});
module.exports = exports.default;