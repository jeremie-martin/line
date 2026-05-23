Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = d(require("./3.js"));
var i = d(require("./6.js"));
var o = d(require("./4.js"));
var a = d(require("./0.js"));
d(require("./1.js"));
var s = d(require("./5.js"));
var l = d(require("./2.js"));
var u = require("./20.js");
var c = d(require("./37.js"));
function d(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var f = exports.styles = function (e) {
  var t = e.palette.type === "light" ? e.palette.grey[100] : e.palette.grey[900];
  return {
    root: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      boxSizing: "border-box",
      zIndex: e.zIndex.appBar,
      flexShrink: 0
    },
    positionFixed: {
      position: "fixed",
      top: 0,
      left: "auto",
      right: 0
    },
    positionAbsolute: {
      position: "absolute",
      top: 0,
      left: "auto",
      right: 0
    },
    positionStatic: {
      position: "static",
      flexShrink: 0
    },
    colorDefault: {
      backgroundColor: t,
      color: e.palette.getContrastText(t)
    },
    colorPrimary: {
      backgroundColor: e.palette.primary.main,
      color: e.palette.primary.contrastText
    },
    colorSecondary: {
      backgroundColor: e.palette.secondary.main,
      color: e.palette.secondary.contrastText
    }
  };
};
function p(e) {
  var t;
  var n = e.children;
  var l = e.classes;
  var d = e.className;
  var f = e.color;
  var p = e.position;
  var h = (0, o.default)(e, ["children", "classes", "className", "color", "position"]);
  var m = (0, s.default)(l.root, l["position" + (0, u.capitalize)(p)], (t = {}, (0, i.default)(t, l["color" + (0, u.capitalize)(f)], f !== "inherit"), (0, i.default)(t, "mui-fixed", p === "fixed"), t), d);
  return a.default.createElement(c.default, (0, r.default)({
    square: true,
    component: "header",
    elevation: 4,
    className: m
  }, h), n);
}
p.propTypes = {};
p.defaultProps = {
  color: "primary",
  position: "fixed"
};
exports.default = (0, l.default)(f, {
  name: "MuiAppBar"
})(p);