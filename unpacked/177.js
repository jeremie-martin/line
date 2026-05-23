Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = d(require("./3.js"));
var i = d(require("./4.js"));
var o = d(require("./0.js"));
d(require("./14.js"));
d(require("./1.js"));
var a = require("./63.js");
var s = d(a);
var l = d(require("./394.js"));
var u = d(require("./395.js"));
var c = d(require("./400.js"));
function d(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function f(e) {
  var t = e.autoComplete;
  var n = e.autoFocus;
  var d = e.children;
  var f = e.className;
  var p = e.defaultValue;
  var h = e.disabled;
  var m = e.error;
  var y = e.FormHelperTextProps;
  var g = e.fullWidth;
  var v = e.helperText;
  var b = e.helperTextClassName;
  var _ = e.id;
  var w = e.InputLabelProps;
  var x = e.inputProps;
  var E = e.InputProps;
  var S = e.inputRef;
  var T = e.label;
  var k = e.labelClassName;
  var O = e.multiline;
  var P = e.name;
  var C = e.onChange;
  var I = e.placeholder;
  var M = e.required;
  var L = e.rows;
  var R = e.rowsMax;
  var A = e.select;
  var D = e.SelectProps;
  var N = e.type;
  var j = e.value;
  var F = (0, i.default)(e, ["autoComplete", "autoFocus", "children", "className", "defaultValue", "disabled", "error", "FormHelperTextProps", "fullWidth", "helperText", "helperTextClassName", "id", "InputLabelProps", "inputProps", "InputProps", "inputRef", "label", "labelClassName", "multiline", "name", "onChange", "placeholder", "required", "rows", "rowsMax", "select", "SelectProps", "type", "value"]);
  var B = v && _ ? _ + "-helper-text" : undefined;
  var U = o.default.createElement(s.default, (0, r.default)({
    autoComplete: t,
    autoFocus: n,
    defaultValue: p,
    disabled: h,
    fullWidth: g,
    multiline: O,
    name: P,
    rows: L,
    rowsMax: R,
    type: N,
    value: j,
    id: _,
    inputRef: S,
    onChange: C,
    placeholder: I,
    inputProps: x
  }, E));
  return o.default.createElement(l.default, (0, r.default)({
    "aria-describedby": B,
    className: f,
    error: m,
    fullWidth: g,
    required: M
  }, F), T && o.default.createElement(a.InputLabel, (0, r.default)({
    htmlFor: _,
    className: k
  }, w), T), A ? o.default.createElement(c.default, (0, r.default)({
    value: j,
    input: U
  }, D), d) : U, v && o.default.createElement(u.default, (0, r.default)({
    className: b,
    id: B
  }, y), v));
}
f.propTypes = {};
f.defaultProps = {
  required: false,
  select: false
};
exports.default = f;