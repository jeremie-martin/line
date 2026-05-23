Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./0.js"));
var i = o(require("./2.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = (0, i.default)({
  root: {
    userSelect: "none"
  }
})(class extends r.default.PureComponent {
  render() {
    var e = this.props;
    const t = e.frameIndex;
    const n = e.fps;
    const i = e.classes;
    const o = e.framesClass;
    const a = n;
    const s = a * 60;
    const l = s * 60;
    let u = Math.floor(t / l);
    let c = t % l;
    let d = Math.floor(c / s);
    c %= s;
    let f = Math.floor(c / a);
    let p = Math.floor(c % a);
    return r.default.createElement("span", {
      className: i.root
    }, u > 0 && r.default.createElement("span", null, u, ":"), r.default.createElement("span", null, u > 0 ? d.toString().padStart(2, "0") : d), r.default.createElement("span", null, ":", f.toString().padStart(2, "0")), r.default.createElement("span", {
      className: o
    }, ":", p.toString().padStart(2, "0")));
  }
});
module.exports = exports.default;