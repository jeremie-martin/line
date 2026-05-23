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
var u = require("./73.js");
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
      height: 1,
      margin: 0,
      border: "none",
      flexShrink: 0
    },
    inset: {
      marginLeft: 72
    },
    default: {
      backgroundColor: e.palette.divider
    },
    light: {
      backgroundColor: (0, u.fade)(e.palette.divider, 0.08)
    },
    absolute: {
      position: "absolute",
      bottom: 0,
      left: 0,
      width: "100%"
    }
  };
};
function f(e) {
  var t;
  var n = e.absolute;
  var l = e.classes;
  var u = e.className;
  var c = e.component;
  var d = e.inset;
  var f = e.light;
  var p = (0, o.default)(e, ["absolute", "classes", "className", "component", "inset", "light"]);
  var h = (0, s.default)(l.root, (t = {}, (0, i.default)(t, l.absolute, n), (0, i.default)(t, l.inset, d), t), f ? l.light : l.default, u);
  return a.default.createElement(c, (0, r.default)({
    className: h
  }, p));
}
f.propTypes = {};
f.defaultProps = {
  absolute: false,
  component: "hr",
  inset: false,
  light: false
};
exports.default = (0, l.default)(d, {
  name: "MuiDivider"
})(f);