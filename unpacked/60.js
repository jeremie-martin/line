Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = p(require("./6.js"));
var i = p(require("./4.js"));
var o = p(require("./3.js"));
var a = p(require("./0.js"));
p(require("./1.js"));
var s = p(require("./5.js"));
var l = p(require("./2.js"));
var u = require("./73.js");
var c = p(require("./32.js"));
var d = require("./20.js");
var f = require("./45.js");
function p(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var h = exports.styles = function (e) {
  return {
    root: (0, o.default)({}, e.typography.button, {
      lineHeight: "1.4em",
      boxSizing: "border-box",
      minWidth: e.spacing.unit * 11,
      minHeight: 36,
      padding: e.spacing.unit + "px " + e.spacing.unit * 2 + "px",
      borderRadius: 2,
      color: e.palette.text.primary,
      transition: e.transitions.create(["background-color", "box-shadow"], {
        duration: e.transitions.duration.short
      }),
      "&:hover": {
        textDecoration: "none",
        backgroundColor: (0, u.fade)(e.palette.text.primary, 0.12),
        "@media (hover: none)": {
          backgroundColor: "transparent"
        },
        "&$disabled": {
          backgroundColor: "transparent"
        }
      }
    }),
    label: {
      width: "100%",
      display: "inherit",
      alignItems: "inherit",
      justifyContent: "inherit"
    },
    flatPrimary: {
      color: e.palette.primary.main,
      "&:hover": {
        backgroundColor: (0, u.fade)(e.palette.primary.main, 0.12),
        "@media (hover: none)": {
          backgroundColor: "transparent"
        }
      }
    },
    flatSecondary: {
      color: e.palette.secondary.main,
      "&:hover": {
        backgroundColor: (0, u.fade)(e.palette.secondary.main, 0.12),
        "@media (hover: none)": {
          backgroundColor: "transparent"
        }
      }
    },
    colorInherit: {
      color: "inherit"
    },
    raised: {
      color: e.palette.getContrastText(e.palette.grey[300]),
      backgroundColor: e.palette.grey[300],
      boxShadow: e.shadows[2],
      "&$keyboardFocused": {
        boxShadow: e.shadows[6]
      },
      "&:active": {
        boxShadow: e.shadows[8]
      },
      "&$disabled": {
        boxShadow: e.shadows[0],
        backgroundColor: e.palette.action.disabledBackground
      },
      "&:hover": {
        backgroundColor: e.palette.grey.A100,
        "@media (hover: none)": {
          backgroundColor: e.palette.grey[300]
        },
        "&$disabled": {
          backgroundColor: e.palette.action.disabledBackground
        }
      }
    },
    keyboardFocused: {},
    raisedPrimary: {
      color: e.palette.primary.contrastText,
      backgroundColor: e.palette.primary.main,
      "&:hover": {
        backgroundColor: e.palette.primary.dark,
        "@media (hover: none)": {
          backgroundColor: e.palette.primary.main
        }
      }
    },
    raisedSecondary: {
      color: e.palette.secondary.contrastText,
      backgroundColor: e.palette.secondary.main,
      "&:hover": {
        backgroundColor: e.palette.secondary.dark,
        "@media (hover: none)": {
          backgroundColor: e.palette.secondary.main
        }
      }
    },
    disabled: {
      color: e.palette.action.disabled
    },
    fab: {
      borderRadius: "50%",
      padding: 0,
      minWidth: 0,
      width: 56,
      fontSize: 24,
      height: 56,
      boxShadow: e.shadows[6],
      "&:active": {
        boxShadow: e.shadows[12]
      }
    },
    mini: {
      width: 40,
      height: 40
    },
    sizeSmall: {
      padding: e.spacing.unit - 1 + "px " + e.spacing.unit + "px",
      minWidth: e.spacing.unit * 8,
      minHeight: 32,
      fontSize: e.typography.pxToRem(e.typography.fontSize - 1)
    },
    sizeLarge: {
      padding: e.spacing.unit + "px " + e.spacing.unit * 3 + "px",
      minWidth: e.spacing.unit * 14,
      minHeight: 40,
      fontSize: e.typography.pxToRem(e.typography.fontSize + 1)
    },
    fullWidth: {
      width: "100%"
    }
  };
};
function m(e) {
  var t;
  var n = e.children;
  var l = e.classes;
  var u = e.className;
  var p = e.color;
  var h = e.disabled;
  var m = e.disableFocusRipple;
  var y = e.fab;
  var g = e.fullWidth;
  var v = e.mini;
  var b = e.raised;
  var _ = e.size;
  var w = (0, i.default)(e, ["children", "classes", "className", "color", "disabled", "disableFocusRipple", "fab", "fullWidth", "mini", "raised", "size"]);
  var x = !b && !y;
  var E = (0, s.default)(l.root, (t = {}, (0, r.default)(t, l.raised, b || y), (0, r.default)(t, l.fab, y), (0, r.default)(t, l.mini, y && v), (0, r.default)(t, l.colorInherit, p === "inherit"), (0, r.default)(t, l.flatPrimary, x && p === "primary"), (0, r.default)(t, l.flatSecondary, x && p === "secondary"), (0, r.default)(t, l.raisedPrimary, !x && p === "primary"), (0, r.default)(t, l.raisedSecondary, !x && p === "secondary"), (0, r.default)(t, l["size" + (0, d.capitalize)(_)], _ !== "medium"), (0, r.default)(t, l.disabled, h), (0, r.default)(t, l.fullWidth, g), t), u);
  var S = n;
  if (y) {
    S = a.default.Children.map(S, function (e) {
      if ((0, f.isMuiElement)(e, ["Icon", "SvgIcon"])) {
        return a.default.cloneElement(e, {
          fontSize: true
        });
      } else {
        return e;
      }
    });
  }
  return a.default.createElement(c.default, (0, o.default)({
    className: E,
    disabled: h,
    focusRipple: !m,
    keyboardFocusedClassName: l.keyboardFocused
  }, w), a.default.createElement("span", {
    className: l.label
  }, S));
}
m.propTypes = {};
m.defaultProps = {
  color: "default",
  disabled: false,
  disableFocusRipple: false,
  disableRipple: false,
  fab: false,
  fullWidth: false,
  mini: false,
  raised: false,
  size: "medium",
  type: "button"
};
exports.default = (0, l.default)(h, {
  name: "MuiButton"
})(m);