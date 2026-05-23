Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = d(require("./3.js"));
var i = d(require("./6.js"));
var o = d(require("./4.js"));
var a = d(require("./0.js"));
var s = d(require("./1.js"));
var l = d(require("./5.js"));
var u = d(require("./2.js"));
var c = require("./46.js");
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
      transformOrigin: "top left"
    },
    formControl: {
      position: "absolute",
      left: 0,
      top: 0,
      transform: "translate(0, " + e.spacing.unit * 3 + "px) scale(1)"
    },
    labelDense: {
      transform: "translate(0, " + (e.spacing.unit * 2.5 + 1) + "px) scale(1)"
    },
    shrink: {
      transform: "translate(0, 1.5px) scale(0.75)",
      transformOrigin: "top left"
    },
    animated: {
      transition: e.transitions.create("transform", {
        duration: e.transitions.duration.shorter,
        easing: e.transitions.easing.easeOut
      })
    },
    disabled: {
      color: e.palette.text.disabled
    }
  };
};
function p(e, t) {
  var n;
  var s = e.children;
  var u = e.classes;
  var d = e.className;
  var f = e.disableAnimation;
  var p = e.disabled;
  var h = e.FormControlClasses;
  var m = e.margin;
  var y = e.shrink;
  var g = (0, o.default)(e, ["children", "classes", "className", "disableAnimation", "disabled", "FormControlClasses", "margin", "shrink"]);
  var v = t.muiFormControl;
  var b = y;
  if (b === undefined && v) {
    b = v.dirty || v.focused || v.adornedStart;
  }
  var _ = m;
  if (_ === undefined && v) {
    _ = v.margin;
  }
  var w = (0, l.default)(u.root, (n = {}, (0, i.default)(n, u.formControl, v), (0, i.default)(n, u.animated, !f), (0, i.default)(n, u.shrink, b), (0, i.default)(n, u.disabled, p), (0, i.default)(n, u.labelDense, _ === "dense"), n), d);
  return a.default.createElement(c.FormLabel, (0, r.default)({
    "data-shrink": b,
    className: w,
    classes: h
  }, g), s);
}
p.propTypes = {};
p.defaultProps = {
  disabled: false,
  disableAnimation: false
};
p.contextTypes = {
  muiFormControl: s.default.object
};
exports.default = (0, u.default)(f, {
  name: "MuiInputLabel"
})(p);