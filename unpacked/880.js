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
      justifyContent: "center",
      height: 56,
      backgroundColor: e.palette.background.paper
    }
  };
};
function c(e) {
  var t = e.children;
  var n = e.classes;
  var s = e.className;
  var l = e.onChange;
  var u = e.showLabels;
  var c = e.value;
  var d = (0, i.default)(e, ["children", "classes", "className", "onChange", "showLabels", "value"]);
  var f = (0, a.default)(n.root, s);
  var p = o.default.Children.map(t, function (e, t) {
    if (!o.default.isValidElement(e)) {
      return null;
    }
    var n = e.props.value || t;
    return o.default.cloneElement(e, {
      selected: n === c,
      showLabel: e.props.showLabel !== undefined ? e.props.showLabel : u,
      value: n,
      onChange: l
    });
  });
  return o.default.createElement("div", (0, r.default)({
    className: f
  }, d), p);
}
c.propTypes = {};
c.defaultProps = {
  showLabels: false
};
exports.default = (0, s.default)(u, {
  name: "MuiBottomNavigation"
})(c);