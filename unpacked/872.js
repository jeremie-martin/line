Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = c(require("./6.js"));
var i = c(require("./3.js"));
var o = c(require("./4.js"));
var a = c(require("./0.js"));
var s = c(require("./1.js"));
var l = c(require("./5.js"));
c(require("./14.js"));
var u = c(require("./2.js"));
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
      width: 36,
      height: 36,
      fontSize: e.typography.pxToRem(18),
      marginRight: 4
    },
    icon: {
      width: 20,
      height: 20,
      fontSize: e.typography.pxToRem(20)
    }
  };
};
function f(e, t) {
  var n = e.children;
  var s = e.classes;
  var u = e.className;
  var c = (0, o.default)(e, ["children", "classes", "className"]);
  if (t.dense === undefined) {
    return e.children;
  } else {
    return a.default.cloneElement(n, (0, i.default)({
      className: (0, l.default)((0, r.default)({}, s.root, t.dense), u, n.props.className),
      childrenClassName: (0, l.default)((0, r.default)({}, s.icon, t.dense), n.props.childrenClassName)
    }, c));
  }
}
f.propTypes = {};
f.contextTypes = {
  dense: s.default.bool
};
f.muiName = "ListItemAvatar";
exports.default = (0, u.default)(d, {
  name: "MuiListItemAvatar"
})(f);