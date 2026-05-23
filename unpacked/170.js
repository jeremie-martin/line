Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fadeWrap = function (e) {
  return function (t) {
    return r.default.createElement(o.default, t, r.default.createElement(s, null, r.default.createElement(e, null)));
  };
};
var r = a(require("./0.js"));
var i = a(require("./239.js"));
var o = a(require("./128.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
class s extends r.default.Component {
  shouldComponentUpdate(e) {
    return this.props.children !== e.children;
  }
  render() {
    return this.props.children;
  }
}
exports.default = class extends r.default.PureComponent {
  render() {
    return r.default.createElement(i.default, {
      component: r.default.Fragment
    }, r.default.Children.map(this.props.children, (e, t) => e && r.default.createElement(o.default, {
      key: t
    }, r.default.createElement(s, null, e))));
  }
};