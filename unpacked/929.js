Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = u(require("./3.js"));
var i = u(require("./6.js"));
var o = u(require("./4.js"));
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
    root: {},
    horizontal: {
      paddingLeft: e.spacing.unit,
      paddingRight: e.spacing.unit,
      "&:first-child": {
        paddingLeft: 0
      },
      "&:last-child": {
        paddingRight: 0
      }
    },
    alternativeLabel: {
      flex: 1,
      position: "relative",
      marginLeft: 0
    }
  };
};
function d(e) {
  var t = e.active;
  var n = e.alternativeLabel;
  var l = e.children;
  var u = e.classes;
  var c = e.className;
  var d = e.completed;
  var f = e.connector;
  var p = e.disabled;
  var h = e.index;
  var m = e.last;
  var y = e.orientation;
  var g = (0, o.default)(e, ["active", "alternativeLabel", "children", "classes", "className", "completed", "connector", "disabled", "index", "last", "orientation"]);
  var v = (0, s.default)(u.root, u[y], (0, i.default)({}, u.alternativeLabel, n), c);
  return a.default.createElement("div", (0, r.default)({
    className: v
  }, g), a.default.Children.map(l, function (e) {
    return a.default.cloneElement(e, (0, r.default)({
      active: t,
      alternativeLabel: n,
      completed: d,
      disabled: p,
      icon: h + 1,
      last: m,
      orientation: y
    }, e.props));
  }), f && n && !m && a.default.cloneElement(f, {
    orientation: y,
    alternativeLabel: n
  }));
}
d.propTypes = {};
d.defaultProps = {
  active: false,
  completed: false,
  disabled: false
};
exports.default = (0, l.default)(c, {
  name: "MuiStep"
})(d);