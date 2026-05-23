Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = u(require("./0.js"));
var i = u(require("./180.js"));
var o = u(require("./297.js"));
var a = u(require("./19.js"));
var s = require("./411.js");
var l = require("./258.js");
function u(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = class extends r.default.PureComponent {
  render() {
    var e = this.props.track;
    var t = e.details;
    let n = t.title;
    let u = t.creator;
    let c = t.description;
    var d = e.cloudInfo;
    let f = (d = d === undefined ? {} : d).saveTime;
    let p = d.derivedFrom;
    return r.default.createElement("div", {
      style: {
        overflowWrap: "break-word"
      }
    }, r.default.createElement(a.default, {
      type: "headline",
      gutterBottom: true,
      style: {
        marginRight: 32
      }
    }, n), u && r.default.createElement(a.default, {
      color: "textSecondary",
      type: "subheading",
      gutterBottom: true
    }, u), f && r.default.createElement(a.default, {
      color: "textSecondary",
      gutterBottom: true
    }, (0, s.getFormattedDate)(f)), p && r.default.createElement(a.default, {
      type: "caption"
    }, "Based on", " ", r.default.createElement("a", {
      target: "_blank",
      href: `/view/${p.version}/${(0, o.default)(p.title)}`
    }, p.title, p.creator && ` by ${p.creator}`)), c && r.default.createElement(a.default, {
      dangerouslySetInnerHTML: {
        __html: (0, i.default)(c, {
          renderer: l.renderer,
          breaks: true,
          sanitize: true
        })
      }
    }));
  }
};
module.exports = exports.default;