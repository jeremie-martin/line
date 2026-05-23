Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = u(require("./0.js"));
var i = require("./15.js");
var o = u(require("./350.js"));
var a = require("./17.js");
var s = u(require("./2.js"));
var l = require("./8.js");
function u(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const c = o.default.supportedValue("cursor", "image-set(url(\"x.png\") 1x, url(\"x.png\") 2x) 0 0, auto");
const d = (0, a.createStructuredSelector)({
  controlsActive: l.getControlsActive,
  cursor: l.getCursor
});
exports.default = (0, i.connect)(d)((0, s.default)({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0
  }
})(class extends r.default.Component {
  constructor(e) {
    super(e);
    const t = (0, a.createSelector)(e => e.cursor || "inherit", e => e.controlsActive, (e, t) => t ? typeof e == "string" ? e : c ? `${o.default.prefix.css}image-set(${e.url1x} 1x, ${e.url2x} 2x) ${e.hotspot.x} ${e.hotspot.y}, ${e.fallback}` : `${e.url1x} ${e.hotspot.x} ${e.hotspot.y}, ${e.fallback}` : "none");
    this.getStyle = (0, a.createStructuredSelector)({
      cursor: t
    });
    this.state = {
      style: this.getStyle(e)
    };
  }
  componentWillReceiveProps(e) {
    let t = this.getStyle(e);
    if (this.state.style !== t) {
      if (c || this.state.style.cursor !== "none" || t.cursor === "none") {
        this.setState({
          style: t
        });
      } else {
        this.setState({
          style: {
            cursor: "inherit"
          }
        });
        requestAnimationFrame(() => this.setState({
          style: t
        }));
      }
    }
  }
  render() {
    return r.default.createElement("div", {
      className: this.props.classes.container,
      style: this.state.style
    }, this.props.children);
  }
}));
module.exports = exports.default;