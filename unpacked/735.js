Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = c(require("./3.js"));
var i = c(require("./6.js"));
var o = c(require("./4.js"));
var a = c(require("./0.js"));
c(require("./1.js"));
var s = c(require("./5.js"));
var l = c(require("./2.js"));
var u = require("./20.js");
function c(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var d = exports.styles = function (e) {
  return {
    root: {
      display: "inline-block",
      fill: "currentColor",
      height: 24,
      width: 24,
      userSelect: "none",
      flexShrink: 0,
      transition: e.transitions.create("fill", {
        duration: e.transitions.duration.shorter
      })
    },
    colorPrimary: {
      color: e.palette.primary.main
    },
    colorSecondary: {
      color: e.palette.secondary.main
    },
    colorAction: {
      color: e.palette.action.active
    },
    colorDisabled: {
      color: e.palette.action.disabled
    },
    colorError: {
      color: e.palette.error.main
    },
    fontSize: {
      width: "1em",
      height: "1em"
    }
  };
};
function f(e) {
  var t;
  var n = e.children;
  var l = e.classes;
  var c = e.className;
  var d = e.color;
  var f = e.fontSize;
  var p = e.nativeColor;
  var h = e.titleAccess;
  var m = e.viewBox;
  var y = (0, o.default)(e, ["children", "classes", "className", "color", "fontSize", "nativeColor", "titleAccess", "viewBox"]);
  var g = (0, s.default)(l.root, (t = {}, (0, i.default)(t, l["color" + (0, u.capitalize)(d)], d !== "inherit"), (0, i.default)(t, l.fontSize, f), t), c);
  return a.default.createElement("svg", (0, r.default)({
    className: g,
    focusable: "false",
    viewBox: m,
    color: p,
    "aria-hidden": h ? "false" : "true"
  }, y), h ? a.default.createElement("title", null, h) : null, n);
}
f.propTypes = {};
f.defaultProps = {
  color: "inherit",
  fontSize: false,
  viewBox: "0 0 24 24"
};
f.muiName = "SvgIcon";
exports.default = (0, l.default)(d, {
  name: "MuiSvgIcon"
})(f);