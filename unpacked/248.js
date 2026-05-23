Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = v(require("./3.js"));
var i = v(require("./6.js"));
var o = v(require("./4.js"));
var a = v(require("./10.js"));
var s = v(require("./9.js"));
var l = v(require("./11.js"));
var u = v(require("./12.js"));
var c = v(require("./13.js"));
var d = v(require("./0.js"));
var f = v(require("./1.js"));
var p = v(require("./5.js"));
var h = v(require("./887.js"));
var m = v(require("./888.js"));
var y = v(require("./2.js"));
var g = v(require("./129.js"));
function v(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var b = exports.styles = {
  root: {
    display: "inline-flex",
    alignItems: "center",
    transition: "none"
  },
  input: {
    cursor: "inherit",
    position: "absolute",
    opacity: 0,
    width: "100%",
    height: "100%",
    top: 0,
    left: 0,
    margin: 0,
    padding: 0
  },
  default: {},
  checked: {},
  disabled: {}
};
var _ = function (e) {
  function t() {
    var e;
    var n;
    var r;
    var i;
    (0, s.default)(this, t);
    for (var o = arguments.length, l = Array(o), c = 0; c < o; c++) {
      l[c] = arguments[c];
    }
    n = r = (0, u.default)(this, (e = t.__proto__ || (0, a.default)(t)).call.apply(e, [this].concat(l)));
    r.state = {};
    r.input = null;
    r.isControlled = null;
    r.handleInputChange = function (e) {
      var t = e.target.checked;
      if (!r.isControlled) {
        r.setState({
          checked: t
        });
      }
      if (r.props.onChange) {
        r.props.onChange(e, t);
      }
    };
    i = n;
    return (0, u.default)(r, i);
  }
  (0, c.default)(t, e);
  (0, l.default)(t, [{
    key: "componentWillMount",
    value: function () {
      var e = this.props;
      this.isControlled = e.checked != null;
      if (!this.isControlled) {
        this.setState({
          checked: e.defaultChecked !== undefined && e.defaultChecked
        });
      }
    }
  }, {
    key: "render",
    value: function () {
      var e;
      var t = this.props;
      var n = t.checked;
      var a = t.checkedIcon;
      var s = t.classes;
      var l = t.className;
      var u = t.disabled;
      var c = t.icon;
      var f = t.inputProps;
      var h = t.inputRef;
      var m = t.inputType;
      var y = t.name;
      t.onChange;
      var v = t.tabIndex;
      var b = t.value;
      var _ = (0, o.default)(t, ["checked", "checkedIcon", "classes", "className", "disabled", "icon", "inputProps", "inputRef", "inputType", "name", "onChange", "tabIndex", "value"]);
      var w = this.context.muiFormControl;
      var x = u;
      if (w && x === undefined) {
        x = w.disabled;
      }
      var E = this.isControlled ? n : this.state.checked;
      var S = (0, p.default)(s.root, s.default, l, (e = {}, (0, i.default)(e, s.checked, E), (0, i.default)(e, s.disabled, x), e));
      var T = E ? a : c;
      return d.default.createElement(g.default, (0, r.default)({
        component: "span",
        className: S,
        disabled: x,
        tabIndex: null,
        role: undefined
      }, _), T, d.default.createElement("input", (0, r.default)({
        type: m,
        name: y,
        checked: n,
        onChange: this.handleInputChange,
        className: s.input,
        disabled: x,
        tabIndex: v,
        value: b,
        ref: h
      }, f)));
    }
  }]);
  return t;
}(d.default.Component);
_.propTypes = {};
_.defaultProps = {
  checkedIcon: d.default.createElement(m.default, null),
  disableRipple: false,
  icon: d.default.createElement(h.default, null),
  inputType: "checkbox"
};
_.contextTypes = {
  muiFormControl: f.default.object
};
exports.default = (0, y.default)(b, {
  name: "MuiSwitchBase"
})(_);