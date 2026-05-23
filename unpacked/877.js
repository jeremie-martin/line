Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = c(require("./6.js"));
var i = c(require("./4.js"));
var o = c(require("./3.js"));
var a = c(require("./0.js"));
c(require("./1.js"));
var s = c(require("./5.js"));
var l = c(require("./2.js"));
var u = c(require("./384.js"));
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
    root: (0, o.default)({}, e.typography.subheading, {
      height: e.spacing.unit * 3,
      boxSizing: "content-box",
      width: "auto",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      "&$selected": {
        backgroundColor: e.palette.action.selected
      },
      "&:hover": {
        backgroundColor: e.palette.action.hover
      }
    }),
    selected: {}
  };
};
function f(e) {
  var t = e.classes;
  var n = e.className;
  var l = e.component;
  var c = e.selected;
  var d = e.role;
  var f = (0, i.default)(e, ["classes", "className", "component", "selected", "role"]);
  var p = (0, s.default)(t.root, (0, r.default)({}, t.selected, c), n);
  return a.default.createElement(u.default, (0, o.default)({
    button: true,
    role: d,
    tabIndex: -1,
    className: p,
    component: l
  }, f));
}
f.propTypes = {};
f.defaultProps = {
  component: "li",
  role: "menuitem",
  selected: false
};
exports.default = (0, l.default)(d, {
  name: "MuiMenuItem"
})(f);