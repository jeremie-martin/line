Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = f(require("./3.js"));
var i = f(require("./6.js"));
var o = f(require("./4.js"));
var a = f(require("./0.js"));
f(require("./1.js"));
var s = f(require("./5.js"));
var l = f(require("./2.js"));
var u = f(require("./32.js"));
var c = require("./20.js");
var d = require("./45.js");
function f(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
require("./23.js");
var p = exports.styles = function (e) {
  return {
    root: {
      textAlign: "center",
      flex: "0 0 auto",
      fontSize: e.typography.pxToRem(24),
      width: e.spacing.unit * 6,
      height: e.spacing.unit * 6,
      padding: 0,
      borderRadius: "50%",
      color: e.palette.action.active,
      transition: e.transitions.create("background-color", {
        duration: e.transitions.duration.shortest
      })
    },
    colorInherit: {
      color: "inherit"
    },
    colorPrimary: {
      color: e.palette.primary.main
    },
    colorSecondary: {
      color: e.palette.secondary.main
    },
    disabled: {
      color: e.palette.action.disabled
    },
    label: {
      width: "100%",
      display: "flex",
      alignItems: "inherit",
      justifyContent: "inherit"
    }
  };
};
function h(e) {
  var t;
  var n = e.children;
  var l = e.classes;
  var f = e.className;
  var p = e.color;
  var h = e.disabled;
  var m = (0, o.default)(e, ["children", "classes", "className", "color", "disabled"]);
  return a.default.createElement(u.default, (0, r.default)({
    className: (0, s.default)(l.root, (t = {}, (0, i.default)(t, l["color" + (0, c.capitalize)(p)], p !== "default"), (0, i.default)(t, l.disabled, h), t), f),
    centerRipple: true,
    focusRipple: true,
    disabled: h
  }, m), a.default.createElement("span", {
    className: l.label
  }, a.default.Children.map(n, function (e) {
    if ((0, d.isMuiElement)(e, ["Icon", "SvgIcon"])) {
      return a.default.cloneElement(e, {
        fontSize: true
      });
    } else {
      return e;
    }
  })));
}
h.propTypes = {};
h.defaultProps = {
  color: "default",
  disabled: false,
  disableRipple: false
};
exports.default = (0, l.default)(p, {
  name: "MuiIconButton"
})(h);