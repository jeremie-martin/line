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
      boxSizing: "border-box",
      lineHeight: "48px",
      listStyle: "none",
      paddingLeft: e.spacing.unit * 2,
      paddingRight: e.spacing.unit * 2,
      color: e.palette.text.secondary,
      fontFamily: e.typography.fontFamily,
      fontWeight: e.typography.fontWeightMedium,
      fontSize: e.typography.pxToRem(e.typography.fontSize)
    },
    colorPrimary: {
      color: e.palette.primary.main
    },
    colorInherit: {
      color: "inherit"
    },
    inset: {
      paddingLeft: e.spacing.unit * 9
    },
    sticky: {
      position: "sticky",
      top: 0,
      zIndex: 1,
      backgroundColor: "inherit"
    }
  };
};
function f(e) {
  var t;
  var n = e.classes;
  var l = e.className;
  var c = e.color;
  var d = e.component;
  var f = e.disableSticky;
  var p = e.inset;
  var h = (0, o.default)(e, ["classes", "className", "color", "component", "disableSticky", "inset"]);
  var m = (0, s.default)(n.root, (t = {}, (0, i.default)(t, n["color" + (0, u.capitalize)(c)], c !== "default"), (0, i.default)(t, n.inset, p), (0, i.default)(t, n.sticky, !f), t), l);
  return a.default.createElement(d, (0, r.default)({
    className: m
  }, h));
}
f.propTypes = {};
f.defaultProps = {
  color: "default",
  component: "li",
  disableSticky: false,
  inset: false
};
f.muiName = "ListSubheader";
exports.default = (0, l.default)(d, {
  name: "MuiListSubheader"
})(f);