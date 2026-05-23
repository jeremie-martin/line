Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = u(require("./6.js"));
var i = u(require("./4.js"));
var o = u(require("./3.js"));
var a = u(require("./0.js"));
u(require("./1.js"));
var s = u(require("./5.js"));
u(require("./14.js"));
var l = u(require("./2.js"));
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
  var t = {};
  e.shadows.forEach(function (e, n) {
    t["shadow" + n] = {
      boxShadow: e
    };
  });
  return (0, o.default)({
    root: {
      backgroundColor: e.palette.background.paper
    },
    rounded: {
      borderRadius: 2
    }
  }, t);
};
function d(e) {
  var t = e.classes;
  var n = e.className;
  var l = e.component;
  var u = e.square;
  var c = e.elevation;
  var d = (0, i.default)(e, ["classes", "className", "component", "square", "elevation"]);
  var f = (0, s.default)(t.root, t["shadow" + (c >= 0 ? c : 0)], (0, r.default)({}, t.rounded, !u), n);
  return a.default.createElement(l, (0, o.default)({
    className: f
  }, d));
}
d.propTypes = {};
d.defaultProps = {
  component: "div",
  elevation: 2,
  square: false
};
exports.default = (0, l.default)(c, {
  name: "MuiPaper"
})(d);