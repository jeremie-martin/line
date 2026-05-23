Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = l(require("./0.js"));
var i = l(require("./801.js"));
var o = l(require("./239.js"));
var a = l(require("./1047.js"));
var s = l(require("./170.js"));
function l(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = class extends r.default.Component {
  render() {
    const e = this.props.views;
    return r.default.createElement(r.default.Fragment, null, r.default.createElement(o.default, {
      component: r.default.Fragment
    }, i.default.map(([t, n]) => e[t] && r.default.createElement(n, {
      key: t,
      page: e[t]
    }))), r.default.createElement(s.default, null, e.tutorial != null && r.default.createElement(a.default, {
      tutorial: e.tutorial
    })));
  }
};
module.exports = exports.default;