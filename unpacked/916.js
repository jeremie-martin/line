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
var u = exports.styles = {
  root: {
    display: "flex",
    flexWrap: "wrap",
    overflowY: "auto",
    listStyle: "none",
    padding: 0,
    WebkitOverflowScrolling: "touch"
  }
};
function c(e) {
  var t = e.cellHeight;
  var n = e.children;
  var s = e.classes;
  var l = e.className;
  var u = e.cols;
  var c = e.component;
  var d = e.spacing;
  var f = e.style;
  var p = (0, i.default)(e, ["cellHeight", "children", "classes", "className", "cols", "component", "spacing", "style"]);
  return o.default.createElement(c, (0, r.default)({
    className: (0, a.default)(s.root, l),
    style: (0, r.default)({
      margin: -d / 2
    }, f)
  }, p), o.default.Children.map(n, function (e) {
    var n = e.props.cols || 1;
    var i = e.props.rows || 1;
    return o.default.cloneElement(e, {
      style: (0, r.default)({
        width: 100 / u * n + "%",
        height: t === "auto" ? "auto" : t * i + d,
        padding: d / 2
      }, e.props.style)
    });
  }));
}
c.propTypes = {};
c.defaultProps = {
  cellHeight: 180,
  cols: 2,
  component: "ul",
  spacing: 4
};
exports.default = (0, s.default)(u, {
  name: "MuiGridList"
})(c);