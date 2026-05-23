Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = f(require("./3.js"));
var i = f(require("./6.js"));
var o = f(require("./4.js"));
var a = f(require("./0.js"));
f(require("./1.js"));
var s = f(require("./5.js"));
var l = f(require("./2.js"));
var u = f(require("./32.js"));
var c = f(require("./401.js"));
var d = require("./45.js");
function f(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var p = exports.styles = {
  root: {
    display: "flex",
    alignItems: "center",
    paddingLeft: 0,
    paddingRight: 0,
    background: "none"
  },
  alternativeLabel: {
    margin: "0 auto"
  }
};
function h(e) {
  var t = e.active;
  var n = e.alternativeLabel;
  var l = e.children;
  var f = e.classes;
  var p = e.className;
  var h = e.completed;
  var m = e.disabled;
  var y = e.icon;
  e.last;
  var g = e.optional;
  var v = e.orientation;
  var b = (0, o.default)(e, ["active", "alternativeLabel", "children", "classes", "className", "completed", "disabled", "icon", "last", "optional", "orientation"]);
  var _ = (0, s.default)(f.root, (0, i.default)({}, f.alternativeLabel, n), p);
  var w = {
    active: t,
    alternativeLabel: n,
    completed: h,
    disabled: m,
    icon: y,
    optional: g,
    orientation: v
  };
  var x = (0, d.isMuiElement)(l, ["StepLabel"]) ? a.default.cloneElement(l, w) : a.default.createElement(c.default, w, l);
  return a.default.createElement(u.default, (0, r.default)({
    disabled: m,
    className: _
  }, b), x);
}
h.propTypes = {};
exports.default = (0, l.default)(p, {
  name: "MuiStepButton"
})(h);