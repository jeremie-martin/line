Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = m(require("./3.js"));
var i = m(require("./6.js"));
var o = m(require("./4.js"));
var a = m(require("./10.js"));
var s = m(require("./9.js"));
var l = m(require("./11.js"));
var u = m(require("./12.js"));
var c = m(require("./13.js"));
var d = m(require("./0.js"));
var f = m(require("./1.js"));
var p = m(require("./5.js"));
var h = m(require("./2.js"));
function m(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var y = exports.styles = function (e) {
  return {
    root: {
      flex: "1 1 auto",
      listStyle: "none",
      margin: 0,
      padding: 0,
      position: "relative"
    },
    padding: {
      paddingTop: e.spacing.unit,
      paddingBottom: e.spacing.unit
    },
    dense: {
      paddingTop: e.spacing.unit / 2,
      paddingBottom: e.spacing.unit / 2
    },
    subheader: {
      paddingTop: 0
    }
  };
};
var g = function (e) {
  function t() {
    (0, s.default)(this, t);
    return (0, u.default)(this, (t.__proto__ || (0, a.default)(t)).apply(this, arguments));
  }
  (0, c.default)(t, e);
  (0, l.default)(t, [{
    key: "getChildContext",
    value: function () {
      return {
        dense: this.props.dense
      };
    }
  }, {
    key: "render",
    value: function () {
      var e;
      var t = this.props;
      var n = t.children;
      var a = t.classes;
      var s = t.className;
      var l = t.component;
      var u = t.dense;
      var c = t.disablePadding;
      var f = t.subheader;
      var h = (0, o.default)(t, ["children", "classes", "className", "component", "dense", "disablePadding", "subheader"]);
      var m = (0, p.default)(a.root, (e = {}, (0, i.default)(e, a.dense, u && !c), (0, i.default)(e, a.padding, !c), (0, i.default)(e, a.subheader, f), e), s);
      return d.default.createElement(l, (0, r.default)({
        className: m
      }, h), f, n);
    }
  }]);
  return t;
}(d.default.Component);
g.propTypes = {};
g.defaultProps = {
  component: "ul",
  dense: false,
  disablePadding: false
};
g.childContextTypes = {
  dense: f.default.bool
};
exports.default = (0, h.default)(y, {
  name: "MuiList"
})(g);