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
var l = c(require("./2.js"));
var u = require("./20.js");
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
      userSelect: "none"
    },
    colorPrimary: {
      color: e.palette.primary.main
    },
    colorSecondary: {
      color: e.palette.secondary.main
    },
    colorAction: {
      color: e.palette.action.active
    },
    colorDisabled: {
      color: e.palette.action.disabled
    },
    colorError: {
      color: e.palette.error.main
    },
    fontSize: {
      width: "1em",
      height: "1em"
    }
  };
};
function f(e) {
  var t;
  var n = e.children;
  var l = e.classes;
  var c = e.className;
  var d = e.color;
  var f = e.fontSize;
  var p = (0, o.default)(e, ["children", "classes", "className", "color", "fontSize"]);
  var h = (0, s.default)("material-icons", l.root, (t = {}, (0, i.default)(t, l["color" + (0, u.capitalize)(d)], d !== "inherit"), (0, i.default)(t, l.fontSize, f), t), c);
  return a.default.createElement("span", (0, r.default)({
    className: h,
    "aria-hidden": "true"
  }, p), n);
}
f.propTypes = {};
f.defaultProps = {
  color: "inherit",
  fontSize: false
};
f.muiName = "Icon";
exports.default = (0, l.default)(d, {
  name: "MuiIcon"
})(f);