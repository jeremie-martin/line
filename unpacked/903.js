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
      fontFamily: e.typography.fontFamily,
      color: e.palette.text.secondary,
      fontSize: e.typography.pxToRem(16),
      lineHeight: 1,
      padding: 0
    },
    focused: {
      color: e.palette.primary[e.palette.type === "light" ? "dark" : "light"]
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
  var s = e.children;
  var u = e.classes;
  var c = e.className;
  var d = e.component;
  var f = e.disabled;
  var p = e.error;
  var h = e.focused;
  var m = e.required;
  var y = (0, o.default)(e, ["children", "classes", "className", "component", "disabled", "error", "focused", "required"]);
  var g = t.muiFormControl;
  var v = m;
  var b = h;
  var _ = f;
  var w = p;
  if (g) {
    if (v === undefined) {
      v = g.required;
    }
    if (b === undefined) {
      b = g.focused;
    }
    if (_ === undefined) {
      _ = g.disabled;
    }
    if (w === undefined) {
      w = g.error;
    }
  }
  var x = (0, l.default)(u.root, (n = {}, (0, i.default)(n, u.focused, b), (0, i.default)(n, u.disabled, _), (0, i.default)(n, u.error, w), n), c);
  var E = (0, l.default)((0, i.default)({}, u.error, w));
  return a.default.createElement(d, (0, r.default)({
    className: x
  }, y), s, v && a.default.createElement("span", {
    className: E
  }, "\u2009*"));
}
f.propTypes = {};
f.defaultProps = {
  component: "label"
};
f.contextTypes = {
  muiFormControl: s.default.object
};
exports.default = (0, u.default)(d, {
  name: "MuiFormLabel"
})(f);