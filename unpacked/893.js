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
require("./246.js");
var u = exports.styles = function (e) {
  return {
    root: {
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      margin: e.spacing.unit + "px " + e.spacing.unit / 2 + "px",
      flex: "0 0 auto"
    },
    action: {
      margin: "0 " + e.spacing.unit / 2 + "px"
    },
    button: {
      minWidth: 64
    }
  };
};
function c(e) {
  var t = e.children;
  var n = e.classes;
  var s = e.className;
  var l = (0, i.default)(e, ["children", "classes", "className"]);
  return o.default.createElement("div", (0, r.default)({
    className: (0, a.default)(n.root, s)
  }, l), o.default.Children.map(t, function (e) {
    if (o.default.isValidElement(e)) {
      return o.default.createElement("div", {
        className: n.action
      }, o.default.cloneElement(e, {
        className: (0, a.default)(n.button, e.props.className)
      }));
    } else {
      return null;
    }
  }));
}
c.propTypes = {};
exports.default = (0, s.default)(u, {
  name: "MuiDialogActions"
})(c);