Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = u(require("./3.js"));
var i = u(require("./4.js"));
var o = u(require("./0.js"));
u(require("./1.js"));
var a = u(require("./5.js"));
var s = u(require("./2.js"));
var l = u(require("./19.js"));
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
      margin: 0,
      padding: e.spacing.unit * 3 + "px " + e.spacing.unit * 3 + "px       20px " + e.spacing.unit * 3 + "px",
      flex: "0 0 auto"
    }
  };
};
function d(e) {
  var t = e.children;
  var n = e.classes;
  var s = e.className;
  var u = e.disableTypography;
  var c = (0, i.default)(e, ["children", "classes", "className", "disableTypography"]);
  return o.default.createElement("div", (0, r.default)({
    className: (0, a.default)(n.root, s)
  }, c), u ? t : o.default.createElement(l.default, {
    type: "title"
  }, t));
}
d.propTypes = {};
d.defaultProps = {
  disableTypography: false
};
exports.default = (0, s.default)(c, {
  name: "MuiDialogTitle"
})(d);