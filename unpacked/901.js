Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = l(require("./3.js"));
var i = l(require("./4.js"));
var o = l(require("./0.js"));
l(require("./1.js"));
var a = l(require("./5.js"));
var s = l(require("./2.js"));
function l(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var u = exports.styles = function (e) {
  return {
    root: {
      display: "flex",
      flexGrow: 1,
      padding: e.spacing.unit + "px " + e.spacing.unit * 3 + "px " + e.spacing.unit * 3 + "px"
    }
  };
};
function c(e) {
  var t = e.classes;
  var n = e.children;
  var s = e.className;
  var l = (0, i.default)(e, ["classes", "children", "className"]);
  return o.default.createElement("div", (0, r.default)({
    className: (0, a.default)(t.root, s)
  }, l), n);
}
c.propTypes = {};
exports.default = (0, s.default)(u, {
  name: "MuiExpansionPanelDetails"
})(c);