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
      position: "relative",
      display: "inline-flex",
      verticalAlign: "middle"
    },
    badge: {
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      alignContent: "center",
      alignItems: "center",
      position: "absolute",
      top: -12,
      right: -12,
      fontFamily: e.typography.fontFamily,
      fontWeight: e.typography.fontWeight,
      fontSize: e.typography.pxToRem(12),
      width: 24,
      height: 24,
      borderRadius: "50%",
      backgroundColor: e.palette.color,
      color: e.palette.textColor,
      zIndex: 1
    },
    colorPrimary: {
      backgroundColor: e.palette.primary.main,
      color: e.palette.primary.contrastText
    },
    colorSecondary: {
      backgroundColor: e.palette.secondary.main,
      color: e.palette.secondary.contrastText
    },
    colorError: {
      backgroundColor: e.palette.error.main,
      color: e.palette.error.contrastText
    }
  };
};
function f(e) {
  var t = e.badgeContent;
  var n = e.children;
  var l = e.classes;
  var c = e.className;
  var d = e.color;
  var f = e.component;
  var p = (0, o.default)(e, ["badgeContent", "children", "classes", "className", "color", "component"]);
  var h = (0, s.default)(l.badge, (0, i.default)({}, l["color" + (0, u.capitalize)(d)], d !== "default"));
  return a.default.createElement(f, (0, r.default)({
    className: (0, s.default)(l.root, c)
  }, p), n, a.default.createElement("span", {
    className: h
  }, t));
}
f.propTypes = {};
f.defaultProps = {
  color: "default",
  component: "span"
};
exports.default = (0, l.default)(d, {
  name: "MuiBadge"
})(f);