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
      padding: e.spacing.unit * 2,
      "&:last-child": {
        paddingBottom: e.spacing.unit * 3
      }
    }
  };
};
function c(e) {
  var t = e.classes;
  var n = e.className;
  var s = e.component;
  var l = (0, i.default)(e, ["classes", "className", "component"]);
  return o.default.createElement(s, (0, r.default)({
    className: (0, a.default)(t.root, n)
  }, l));
}
c.propTypes = {};
c.defaultProps = {
  component: "div"
};
exports.default = (0, s.default)(u, {
  name: "MuiCardContent"
})(c);