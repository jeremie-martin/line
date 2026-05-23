Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = d(require("./3.js"));
var i = d(require("./4.js"));
var o = d(require("./0.js"));
d(require("./1.js"));
var a = d(require("./5.js"));
var s = d(require("./403.js"));
var l = d(require("./404.js"));
var u = d(require("./2.js"));
var c = d(require("./32.js"));
function d(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var f = exports.styles = function (e) {
  return {
    root: {
      color: "inherit",
      flex: "0 0 " + e.spacing.unit * 7 + "px"
    }
  };
};
var p = o.default.createElement(s.default, null);
var h = o.default.createElement(l.default, null);
function m(e) {
  var t = e.classes;
  var n = e.className;
  var s = e.direction;
  var l = e.onClick;
  var u = e.visible;
  var d = (0, i.default)(e, ["classes", "className", "direction", "onClick", "visible"]);
  var f = (0, a.default)(t.root, n);
  if (u) {
    return o.default.createElement(c.default, (0, r.default)({
      className: f,
      onClick: l,
      tabIndex: -1
    }, d), s === "left" ? p : h);
  } else {
    return o.default.createElement("div", {
      className: f
    });
  }
}
m.propTypes = {};
m.defaultProps = {
  visible: true
};
exports.default = (0, u.default)(f, {
  name: "MuiTabScrollButton"
})(m);