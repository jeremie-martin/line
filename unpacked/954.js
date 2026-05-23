Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = u(require("./3.js"));
var i = u(require("./6.js"));
var o = u(require("./0.js"));
u(require("./1.js"));
var a = u(require("./5.js"));
var s = u(require("./2.js"));
var l = require("./20.js");
function u(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var c = exports.styles = function (e) {
  return {
    root: {
      position: "absolute",
      height: 2,
      bottom: 0,
      width: "100%",
      transition: e.transitions.create(),
      willChange: "left, width"
    },
    colorPrimary: {
      backgroundColor: e.palette.primary.main
    },
    colorSecondary: {
      backgroundColor: e.palette.secondary.main
    }
  };
};
function d(e) {
  var t = e.classes;
  var n = e.className;
  var s = e.color;
  var u = e.style;
  var c = ["primary", "secondary"].indexOf(s) !== -1;
  var d = (0, a.default)(t.root, (0, i.default)({}, t["color" + (0, l.capitalize)(s)], c), n);
  var f = c ? u : (0, r.default)({}, u, {
    backgroundColor: s
  });
  return o.default.createElement("span", {
    className: d,
    style: f
  });
}
d.propTypes = {};
exports.default = (0, s.default)(c, {
  name: "MuiTabIndicator"
})(d);