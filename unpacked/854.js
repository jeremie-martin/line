Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = d(require("./10.js"));
var i = d(require("./9.js"));
var o = d(require("./11.js"));
var a = d(require("./12.js"));
var s = d(require("./13.js"));
var l = d(require("./0.js"));
var u = d(require("./21.js"));
d(require("./1.js"));
var c = d(require("./62.js"));
d(require("./163.js"));
function d(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var f = function (e) {
  function t() {
    var e;
    var n;
    var o;
    var s;
    (0, i.default)(this, t);
    for (var l = arguments.length, u = Array(l), c = 0; c < l; c++) {
      u[c] = arguments[c];
    }
    n = o = (0, a.default)(this, (e = t.__proto__ || (0, r.default)(t)).call.apply(e, [this].concat(u)));
    o.getMountNode = function () {
      return o.mountNode;
    };
    s = n;
    return (0, a.default)(o, s);
  }
  (0, s.default)(t, e);
  (0, o.default)(t, [{
    key: "componentDidMount",
    value: function () {
      this.setContainer(this.props.container);
      this.forceUpdate(this.props.onRendered);
    }
  }, {
    key: "componentWillReceiveProps",
    value: function (e) {
      if (e.container !== this.props.container) {
        this.setContainer(e.container);
      }
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      this.mountNode = null;
    }
  }, {
    key: "setContainer",
    value: function (e) {
      var t;
      this.mountNode = function (e, t) {
        e = typeof e == "function" ? e() : e;
        return u.default.findDOMNode(e) || t;
      }(e, (t = this, (0, c.default)(u.default.findDOMNode(t))).body);
    }
  }, {
    key: "render",
    value: function () {
      var e = this.props.children;
      if (this.mountNode) {
        return u.default.createPortal(e, this.mountNode);
      } else {
        return null;
      }
    }
  }]);
  return t;
}(l.default.Component);
f.propTypes = {};
f.propTypes = {};
exports.default = f;