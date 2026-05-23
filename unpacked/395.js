Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = c(require("./3.js"));
var i = c(require("./6.js"));
var o = c(require("./4.js"));
var a = c(require("./0.js"));
var s = c(require("./1.js"));
var l = c(require("./5.js"));
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
      color: e.palette.text.secondary,
      fontFamily: e.typography.fontFamily,
      fontSize: e.typography.pxToRem(12),
      textAlign: "left",
      marginTop: e.spacing.unit,
      lineHeight: "1em",
      minHeight: "1em",
      margin: 0
    },
    dense: {
      marginTop: e.spacing.unit / 2
    },
    error: {
      color: e.palette.error.main
    },
    disabled: {
      color: e.palette.text.disabled
    }
  };
};
function f(e, t) {
  var n;
  var s = e.classes;
  var u = e.className;
  var c = e.disabled;
  var d = e.error;
  var f = e.margin;
  var p = e.component;
  var h = (0, o.default)(e, ["classes", "className", "disabled", "error", "margin", "component"]);
  var m = t.muiFormControl;
  var y = c;
  var g = d;
  var v = f;
  if (m) {
    if (y === undefined) {
      y = m.disabled;
    }
    if (g === undefined) {
      g = m.error;
    }
    if (v === undefined) {
      v = m.margin;
    }
  }
  var b = (0, l.default)(s.root, (n = {}, (0, i.default)(n, s.disabled, y), (0, i.default)(n, s.error, g), (0, i.default)(n, s.dense, v === "dense"), n), u);
  return a.default.createElement(p, (0, r.default)({
    className: b
  }, h));
}
f.propTypes = {};
f.defaultProps = {
  component: "p"
};
f.contextTypes = {
  muiFormControl: s.default.object
};
exports.default = (0, u.default)(d, {
  name: "MuiFormHelperText"
})(f);