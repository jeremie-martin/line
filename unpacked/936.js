Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = h(require("./3.js"));
var i = h(require("./4.js"));
var o = h(require("./10.js"));
var a = h(require("./9.js"));
var s = h(require("./11.js"));
var l = h(require("./12.js"));
var u = h(require("./13.js"));
var c = h(require("./0.js"));
var d = h(require("./1.js"));
var f = h(require("./5.js"));
var p = h(require("./2.js"));
function h(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var m = exports.styles = function (e) {
  return {
    root: {
      fontFamily: e.typography.fontFamily,
      width: "100%",
      borderCollapse: "collapse",
      borderSpacing: 0,
      overflow: "hidden"
    }
  };
};
var y = function (e) {
  function t() {
    (0, a.default)(this, t);
    return (0, l.default)(this, (t.__proto__ || (0, o.default)(t)).apply(this, arguments));
  }
  (0, u.default)(t, e);
  (0, s.default)(t, [{
    key: "getChildContext",
    value: function () {
      return {
        table: {}
      };
    }
  }, {
    key: "render",
    value: function () {
      var e = this.props;
      var t = e.classes;
      var n = e.className;
      var o = e.component;
      var a = (0, i.default)(e, ["classes", "className", "component"]);
      return c.default.createElement(o, (0, r.default)({
        className: (0, f.default)(t.root, n)
      }, a));
    }
  }]);
  return t;
}(c.default.Component);
y.propTypes = {};
y.defaultProps = {
  component: "table"
};
y.childContextTypes = {
  table: d.default.object
};
exports.default = (0, p.default)(m, {
  name: "MuiTable"
})(y);