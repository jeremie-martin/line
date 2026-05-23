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
var l = require("./45.js");
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
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      padding: e.spacing.unit * 2 + "px " + e.spacing.unit + "px"
    },
    action: {
      marginLeft: e.spacing.unit
    }
  };
};
function d(e) {
  var t = e.children;
  var n = e.classes;
  var s = e.className;
  var u = (0, i.default)(e, ["children", "classes", "className"]);
  return o.default.createElement("div", (0, r.default)({
    className: (0, a.default)(n.root, s)
  }, u), (0, l.cloneChildrenWithClassName)(t, n.action));
}
d.propTypes = {};
exports.default = (0, s.default)(c, {
  name: "MuiExpansionPanelActions"
})(d);