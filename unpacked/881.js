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
m(require("./1.js"));
var f = m(require("./5.js"));
var p = m(require("./2.js"));
var h = m(require("./32.js"));
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
      transition: e.transitions.create(["color", "padding-top"], {
        duration: e.transitions.duration.short
      }),
      paddingTop: e.spacing.unit,
      paddingBottom: 10,
      paddingLeft: 12,
      paddingRight: 12,
      minWidth: 80,
      maxWidth: 168,
      color: e.palette.text.secondary,
      flex: "1"
    },
    selected: {
      paddingTop: 6,
      color: e.palette.primary.main
    },
    selectedIconOnly: {
      paddingTop: e.spacing.unit * 2
    },
    wrapper: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      flexDirection: "column"
    },
    label: {
      fontFamily: e.typography.fontFamily,
      fontSize: e.typography.pxToRem(e.typography.fontSize - 2),
      opacity: 1,
      transition: "font-size 0.2s, opacity 0.2s",
      transitionDelay: "0.1s"
    },
    selectedLabel: {
      fontSize: e.typography.pxToRem(e.typography.fontSize)
    },
    hiddenLabel: {
      opacity: 0,
      transitionDelay: "0s"
    }
  };
};
var g = function (e) {
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
    r.handleChange = function (e) {
      var t = r.props;
      var n = t.onChange;
      var i = t.value;
      var o = t.onClick;
      if (n) {
        n(e, i);
      }
      if (o) {
        o(e);
      }
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
      var l = n.icon;
      var u = n.label;
      n.onChange;
      n.onClick;
      var c = n.selected;
      var p = n.showLabel;
      n.value;
      var m = (0, o.default)(n, ["classes", "className", "icon", "label", "onChange", "onClick", "selected", "showLabel", "value"]);
      var y = (0, f.default)(a.root, (e = {}, (0, i.default)(e, a.selected, c), (0, i.default)(e, a.selectedIconOnly, !p && !c), e), s);
      var g = (0, f.default)(a.label, (t = {}, (0, i.default)(t, a.selectedLabel, c), (0, i.default)(t, a.hiddenLabel, !p && !c), t));
      return d.default.createElement(h.default, (0, r.default)({
        className: y,
        focusRipple: true,
        onClick: this.handleChange
      }, m), d.default.createElement("span", {
        className: a.wrapper
      }, l, d.default.createElement("span", {
        className: g
      }, u)));
    }
  }]);
  return t;
}(d.default.Component);
g.propTypes = {};
exports.default = (0, p.default)(y, {
  name: "MuiBottomNavigationAction"
})(g);