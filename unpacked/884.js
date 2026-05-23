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
var c = exports.styles = {
  root: {
    height: 52,
    display: "flex",
    alignItems: "center",
    padding: "2px 4px",
    boxSizing: "border-box"
  },
  action: {
    margin: "0 4px"
  }
};
function d(e) {
  var t = e.disableActionSpacing;
  var n = e.children;
  var s = e.classes;
  var u = e.className;
  var c = (0, i.default)(e, ["disableActionSpacing", "children", "classes", "className"]);
  return o.default.createElement("div", (0, r.default)({
    className: (0, a.default)(s.root, u)
  }, c), t ? n : (0, l.cloneChildrenWithClassName)(n, s.action));
}
d.propTypes = {};
d.defaultProps = {
  disableActionSpacing: false
};
exports.default = (0, s.default)(c, {
  name: "MuiCardActions"
})(d);