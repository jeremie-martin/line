Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = g(require("./3.js"));
var i = g(require("./6.js"));
var o = g(require("./4.js"));
var a = g(require("./10.js"));
var s = g(require("./9.js"));
var l = g(require("./11.js"));
var u = g(require("./12.js"));
var c = g(require("./13.js"));
var d = g(require("./0.js"));
var f = g(require("./1.js"));
var p = g(require("./5.js"));
var h = g(require("./2.js"));
var m = g(require("./32.js"));
var y = require("./45.js");
function g(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var v = exports.styles = function (e) {
  return {
    root: {
      display: "flex",
      justifyContent: "flex-start",
      alignItems: "center",
      position: "relative",
      textDecoration: "none",
      width: "100%",
      boxSizing: "border-box",
      textAlign: "left"
    },
    container: {
      position: "relative"
    },
    keyboardFocused: {
      backgroundColor: e.palette.action.hover
    },
    default: {
      paddingTop: 12,
      paddingBottom: 12
    },
    dense: {
      paddingTop: e.spacing.unit,
      paddingBottom: e.spacing.unit
    },
    disabled: {
      opacity: 0.5
    },
    divider: {
      borderBottom: "1px solid " + e.palette.divider,
      backgroundClip: "padding-box"
    },
    gutters: {
      paddingLeft: e.spacing.unit * 2,
      paddingRight: e.spacing.unit * 2
    },
    button: {
      transition: e.transitions.create("background-color", {
        duration: e.transitions.duration.shortest
      }),
      "&:hover": {
        textDecoration: "none",
        backgroundColor: e.palette.action.hover,
        "@media (hover: none)": {
          backgroundColor: "transparent"
        },
        "&$disabled": {
          backgroundColor: "transparent"
        }
      }
    },
    secondaryAction: {
      paddingRight: e.spacing.unit * 4
    }
  };
};
var b = function (e) {
  function t() {
    (0, s.default)(this, t);
    return (0, u.default)(this, (t.__proto__ || (0, a.default)(t)).apply(this, arguments));
  }
  (0, c.default)(t, e);
  (0, l.default)(t, [{
    key: "getChildContext",
    value: function () {
      return {
        dense: this.props.dense || this.context.dense || false
      };
    }
  }, {
    key: "render",
    value: function () {
      var e;
      var t = this.props;
      var n = t.button;
      var a = t.children;
      var s = t.classes;
      var l = t.className;
      var u = t.component;
      var c = t.ContainerComponent;
      var f = t.ContainerProps;
      var h = t.dense;
      var g = t.disabled;
      var v = t.disableGutters;
      var b = t.divider;
      var _ = (0, o.default)(t, ["button", "children", "classes", "className", "component", "ContainerComponent", "ContainerProps", "dense", "disabled", "disableGutters", "divider"]);
      var w = h || this.context.dense || false;
      var x = d.default.Children.toArray(a);
      var E = x.some(function (e) {
        return (0, y.isMuiElement)(e, ["ListItemAvatar"]);
      });
      var S = x.length && (0, y.isMuiElement)(x[x.length - 1], ["ListItemSecondaryAction"]);
      var T = (0, p.default)(s.root, w || E ? s.dense : s.default, (e = {}, (0, i.default)(e, s.gutters, !v), (0, i.default)(e, s.divider, b), (0, i.default)(e, s.disabled, g), (0, i.default)(e, s.button, n), (0, i.default)(e, s.secondaryAction, S), e), l);
      var k = (0, r.default)({
        className: T,
        disabled: g
      }, _);
      var O = u || "li";
      if (n) {
        k.component = u || "div";
        k.keyboardFocusedClassName = s.keyboardFocused;
        O = m.default;
      }
      if (S) {
        O = O === m.default || u ? O : "div";
        return d.default.createElement(c, (0, r.default)({
          className: s.container
        }, f), d.default.createElement(O, k, x), x.pop());
      } else {
        return d.default.createElement(O, k, x);
      }
    }
  }]);
  return t;
}(d.default.Component);
b.propTypes = {};
b.defaultProps = {
  button: false,
  ContainerComponent: "li",
  dense: false,
  disabled: false,
  disableGutters: false,
  divider: false
};
b.contextTypes = {
  dense: f.default.bool
};
b.childContextTypes = {
  dense: f.default.bool
};
exports.default = (0, h.default)(v, {
  name: "MuiListItem"
})(b);