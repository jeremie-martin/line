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
var c = d(require("./19.js"));
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
      display: "inline-flex",
      alignItems: "center",
      cursor: "pointer",
      verticalAlign: "middle",
      WebkitTapHighlightColor: "transparent",
      marginLeft: -14,
      marginRight: e.spacing.unit * 2
    },
    disabled: {
      color: e.palette.text.disabled,
      cursor: "default"
    },
    label: {}
  };
};
function p(e, t) {
  var n = e.checked;
  var s = e.classes;
  var u = e.className;
  var d = e.control;
  var f = e.disabled;
  var p = e.inputRef;
  var h = e.label;
  var m = e.name;
  var y = e.onChange;
  var g = e.value;
  var v = (0, o.default)(e, ["checked", "classes", "className", "control", "disabled", "inputRef", "label", "name", "onChange", "value"]);
  var b = t.muiFormControl;
  var _ = f;
  if (d.props.disabled !== undefined && _ === undefined) {
    _ = d.props.disabled;
  }
  if (b && _ === undefined) {
    _ = b.disabled;
  }
  var w = (0, l.default)(s.root, (0, i.default)({}, s.disabled, _), u);
  return a.default.createElement("label", (0, r.default)({
    className: w
  }, v), a.default.cloneElement(d, {
    disabled: _,
    checked: d.props.checked === undefined ? n : d.props.checked,
    name: d.props.name || m,
    onChange: d.props.onChange || y,
    value: d.props.value || g,
    inputRef: d.props.inputRef || p
  }), a.default.createElement(c.default, {
    component: "span",
    className: s.label
  }, h));
}
p.propTypes = {};
p.contextTypes = {
  muiFormControl: s.default.object
};
exports.default = (0, u.default)(f, {
  name: "MuiFormControlLabel"
})(p);