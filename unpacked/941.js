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
  return {
    root: (0, o.default)({
      position: "relative",
      display: "flex",
      alignItems: "center"
    }, e.mixins.toolbar),
    gutters: e.mixins.gutters({})
  };
};
function d(e) {
  var t = e.children;
  var n = e.classes;
  var l = e.className;
  var u = e.disableGutters;
  var c = (0, i.default)(e, ["children", "classes", "className", "disableGutters"]);
  var d = (0, s.default)(n.root, (0, r.default)({}, n.gutters, !u), l);
  return a.default.createElement("div", (0, o.default)({
    className: d
  }, c), t);
}
d.propTypes = {};
d.defaultProps = {
  disableGutters: false
};
exports.default = (0, l.default)(c, {
  name: "MuiToolbar"
})(d);