Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = h(require("./3.js"));
var i = h(require("./6.js"));
var o = h(require("./4.js"));
var a = h(require("./10.js"));
var s = h(require("./9.js"));
var l = h(require("./11.js"));
var u = h(require("./12.js"));
var c = h(require("./13.js"));
var d = h(require("./0.js"));
h(require("./1.js"));
var f = h(require("./5.js"));
var p = h(require("./89.js"));
function h(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var m = function (e) {
  function t() {
    var e;
    var n;
    var r;
    var i;
    (0, s.default)(this, t);
    for (var o = arguments.length, l = Array(o), c = 0; c < o; c++) {
      l[c] = arguments[c];
    }
    n = r = (0, u.default)(this, (e = t.__proto__ || (0, a.default)(t)).call.apply(e, [this].concat(l)));
    r.state = {
      rippleVisible: false,
      rippleLeaving: false
    };
    r.handleEnter = function () {
      r.setState({
        rippleVisible: true
      });
    };
    r.handleExit = function () {
      r.setState({
        rippleLeaving: true
      });
    };
    i = n;
    return (0, u.default)(r, i);
  }
  (0, c.default)(t, e);
  (0, l.default)(t, [{
    key: "render",
    value: function () {
      var e;
      var t;
      var n = this.props;
      var a = n.classes;
      var s = n.className;
      var l = n.pulsate;
      var u = n.rippleX;
      var c = n.rippleY;
      var h = n.rippleSize;
      var m = (0, o.default)(n, ["classes", "className", "pulsate", "rippleX", "rippleY", "rippleSize"]);
      var y = this.state;
      var g = y.rippleVisible;
      var v = y.rippleLeaving;
      var b = (0, f.default)(a.wrapper, (e = {}, (0, i.default)(e, a.wrapperLeaving, v), (0, i.default)(e, a.wrapperPulsating, l), e), s);
      var _ = (0, f.default)(a.ripple, (t = {}, (0, i.default)(t, a.rippleVisible, g), (0, i.default)(t, a.rippleFast, l), t));
      var w = {
        width: h,
        height: h,
        top: -h / 2 + c,
        left: -h / 2 + u
      };
      return d.default.createElement(p.default, (0, r.default)({
        onEnter: this.handleEnter,
        onExit: this.handleExit
      }, m), d.default.createElement("span", {
        className: b
      }, d.default.createElement("span", {
        className: _,
        style: w
      })));
    }
  }]);
  return t;
}(d.default.Component);
m.propTypes = {};
m.defaultProps = {
  pulsate: false
};
exports.default = m;