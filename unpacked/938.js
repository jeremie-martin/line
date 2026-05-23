Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = d(require("./4.js"));
var i = d(require("./10.js"));
var o = d(require("./9.js"));
var a = d(require("./11.js"));
var s = d(require("./12.js"));
var l = d(require("./13.js"));
var u = d(require("./0.js"));
var c = d(require("./1.js"));
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
    (0, o.default)(this, t);
    return (0, s.default)(this, (t.__proto__ || (0, i.default)(t)).apply(this, arguments));
  }
  (0, l.default)(t, e);
  (0, a.default)(t, [{
    key: "getChildContext",
    value: function () {
      return {
        table: {
          footer: true
        }
      };
    }
  }, {
    key: "render",
    value: function () {
      var e = this.props;
      var t = e.component;
      var n = (0, r.default)(e, ["component"]);
      return u.default.createElement(t, n);
    }
  }]);
  return t;
}(u.default.Component);
f.propTypes = {};
f.defaultProps = {
  component: "tfoot"
};
f.childContextTypes = {
  table: c.default.object
};
exports.default = f;