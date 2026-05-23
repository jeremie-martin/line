Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = l(require("./0.js"));
var i = require("./124.js");
var o = l(require("./19.js"));
var a = require("./15.js");
var s = require("./151.js");
function l(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = (0, a.connect)((e, t) => ({
  progress: t.id && (0, s.getProgress)(e, t.id)
}), null, (e, t, n) => Object.assign({}, e, n))(class extends r.default.PureComponent {
  render() {
    var e = this.props;
    let t = e.circular;
    var n = e.progress;
    let a = (n = n === undefined ? {} : n).status;
    let s = n.percent;
    let l = s != null;
    let u = typeof s == "number";
    let c = u ? "determinate" : "indeterminate";
    let d = u ? s : 0;
    if (t) {
      return l && r.default.createElement(i.CircularProgress, {
        mode: c,
        value: d
      });
    } else {
      return r.default.createElement("div", {
        style: {
          height: 24
        }
      }, l && r.default.createElement(r.default.Fragment, null, r.default.createElement(o.default, {
        type: "caption"
      }, a), r.default.createElement(i.LinearProgress, {
        mode: c,
        value: d
      })));
    }
  }
});
module.exports = exports.default;