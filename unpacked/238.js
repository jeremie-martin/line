Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = d(require("./10.js"));
var i = d(require("./9.js"));
var o = d(require("./11.js"));
var a = d(require("./12.js"));
var s = d(require("./13.js"));
var l = d(require("./0.js"));
d(require("./1.js"));
var u = require("./21.js");
var c = d(require("./44.js"));
function d(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var f = function e(t, n) {
  return n !== null && !!n.parentNode && (t === n || e(t, n.parentNode));
};
var p = function (e) {
  function t() {
    var e;
    var n;
    var o;
    var s;
    (0, i.default)(this, t);
    for (var l = arguments.length, c = Array(l), d = 0; d < l; d++) {
      c[d] = arguments[d];
    }
    n = o = (0, a.default)(this, (e = t.__proto__ || (0, r.default)(t)).call.apply(e, [this].concat(c)));
    o.mounted = false;
    o.handleClickAway = function (e) {
      if (!e.defaultPrevented && o.mounted) {
        var t = (0, u.findDOMNode)(o);
        if (e.target instanceof HTMLElement && document.documentElement && document.documentElement.contains(e.target) && !f(t, e.target)) {
          o.props.onClickAway(e);
        }
      }
    };
    s = n;
    return (0, a.default)(o, s);
  }
  (0, s.default)(t, e);
  (0, o.default)(t, [{
    key: "componentDidMount",
    value: function () {
      this.mounted = true;
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      this.mounted = false;
    }
  }, {
    key: "render",
    value: function () {
      return l.default.createElement(c.default, {
        target: "document",
        onMouseup: this.handleClickAway,
        onTouchend: this.handleClickAway
      }, this.props.children);
    }
  }]);
  return t;
}(l.default.Component);
p.propTypes = {};
exports.default = p;