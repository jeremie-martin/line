Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = l(require("./4.js"));
var i = l(require("./3.js"));
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
    root: (0, i.default)({}, e.typography.subheading, {
      color: e.palette.text.secondary,
      margin: 0
    })
  };
};
function c(e) {
  var t = e.children;
  var n = e.classes;
  var s = e.className;
  var l = (0, r.default)(e, ["children", "classes", "className"]);
  return o.default.createElement("p", (0, i.default)({
    className: (0, a.default)(n.root, s)
  }, l), t);
}
c.propTypes = {};
exports.default = (0, s.default)(u, {
  name: "MuiDialogContentText"
})(c);