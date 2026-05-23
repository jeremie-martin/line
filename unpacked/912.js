Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = c(require("./3.js"));
var i = c(require("./6.js"));
var o = c(require("./4.js"));
var a = c(require("./0.js"));
c(require("./1.js"));
var s = c(require("./5.js"));
var l = c(require("./19.js"));
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
      "label + div > &": {
        marginTop: -e.spacing.unit * 2,
        height: 26,
        display: "flex"
      }
    },
    positionStart: {
      marginRight: e.spacing.unit
    },
    positionEnd: {
      marginLeft: e.spacing.unit
    }
  };
};
function f(e) {
  var t;
  var n = e.children;
  var u = e.component;
  var c = e.classes;
  var d = e.className;
  var f = e.disableTypography;
  var p = e.position;
  var h = (0, o.default)(e, ["children", "component", "classes", "className", "disableTypography", "position"]);
  return a.default.createElement(u, (0, r.default)({
    className: (0, s.default)(c.root, (t = {}, (0, i.default)(t, c.positionStart, p === "start"), (0, i.default)(t, c.positionEnd, p === "end"), t), d)
  }, h), typeof n != "string" || f ? n : a.default.createElement(l.default, {
    color: "textSecondary"
  }, n));
}
f.propTypes = {};
f.defaultProps = {
  component: "div",
  disableTypography: false
};
exports.default = (0, u.default)(d, {
  name: "MuiInputAdornment"
})(f);