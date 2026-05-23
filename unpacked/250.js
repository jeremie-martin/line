Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = y(require("./3.js"));
var i = y(require("./6.js"));
var o = y(require("./4.js"));
var a = y(require("./10.js"));
var s = y(require("./9.js"));
var l = y(require("./11.js"));
var u = y(require("./12.js"));
var c = y(require("./13.js"));
exports.hasValue = g;
exports.isDirty = v;
exports.isAdornedStart = function (e) {
  return e.startAdornment;
};
var d = y(require("./0.js"));
var f = y(require("./1.js"));
var p = y(require("./5.js"));
var h = y(require("./2.js"));
var m = y(require("./904.js"));
function y(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function g(e) {
  return e != null && (!Array.isArray(e) || e.length !== 0);
}
function v(e, t = false) {
  return e && (g(e.value) && e.value !== "" || t && g(e.defaultValue) && e.defaultValue !== "");
}
var b = exports.styles = function (e) {
  var t = e.palette.type === "light";
  var n = {
    color: "currentColor",
    opacity: t ? 0.42 : 0.5,
    transition: e.transitions.create("opacity", {
      duration: e.transitions.duration.shorter,
      easing: e.transitions.easing.ease
    })
  };
  var r = {
    opacity: 0
  };
  var i = {
    opacity: t ? 0.42 : 0.5
  };
  var o = t ? "rgba(0, 0, 0, 0.42)" : "rgba(255, 255, 255, 0.7)";
  return {
    root: {
      display: "inline-flex",
      alignItems: "baseline",
      position: "relative",
      fontFamily: e.typography.fontFamily,
      color: t ? "rgba(0, 0, 0, 0.87)" : e.palette.common.white,
      fontSize: e.typography.pxToRem(16)
    },
    formControl: {
      "label + &": {
        marginTop: e.spacing.unit * 2
      }
    },
    inkbar: {
      "&:after": {
        backgroundColor: e.palette.primary[t ? "dark" : "light"],
        left: 0,
        bottom: 0,
        content: "\"\"",
        height: 2,
        position: "absolute",
        right: 0,
        transform: "scaleX(0)",
        transition: e.transitions.create("transform", {
          duration: e.transitions.duration.shorter,
          easing: e.transitions.easing.easeOut
        }),
        pointerEvents: "none"
      },
      "&$focused:after": {
        transform: "scaleX(1)"
      }
    },
    error: {
      "&:after": {
        backgroundColor: e.palette.error.main,
        transform: "scaleX(1)"
      }
    },
    focused: {},
    disabled: {
      color: e.palette.text.disabled
    },
    underline: {
      "&:before": {
        backgroundColor: o,
        left: 0,
        bottom: 0,
        content: "\"\"",
        height: 1,
        position: "absolute",
        right: 0,
        transition: e.transitions.create("background-color", {
          duration: e.transitions.duration.shorter,
          easing: e.transitions.easing.ease
        }),
        pointerEvents: "none"
      },
      "&:hover:not($disabled):before": {
        backgroundColor: e.palette.text.primary,
        height: 2
      },
      "&$disabled:before": {
        background: "transparent",
        backgroundImage: "linear-gradient(to right, " + o + " 33%, transparent 0%)",
        backgroundPosition: "left top",
        backgroundRepeat: "repeat-x",
        backgroundSize: "5px 1px"
      }
    },
    multiline: {
      padding: e.spacing.unit - 2 + "px 0 " + (e.spacing.unit - 1) + "px"
    },
    fullWidth: {
      width: "100%"
    },
    input: {
      font: "inherit",
      color: "currentColor",
      padding: e.spacing.unit - 2 + "px 0 " + (e.spacing.unit - 1) + "px",
      border: 0,
      boxSizing: "content-box",
      verticalAlign: "middle",
      background: "none",
      margin: 0,
      WebkitTapHighlightColor: "transparent",
      display: "block",
      minWidth: 0,
      width: "100%",
      "&::-webkit-input-placeholder": n,
      "&::-moz-placeholder": n,
      "&:-ms-input-placeholder": n,
      "&::-ms-input-placeholder": n,
      "&:focus": {
        outline: 0
      },
      "&:invalid": {
        boxShadow: "none"
      },
      "&::-webkit-search-decoration": {
        "-webkit-appearance": "none"
      },
      "label[data-shrink=false] + $formControl &": {
        "&::-webkit-input-placeholder": r,
        "&::-moz-placeholder": r,
        "&:-ms-input-placeholder": r,
        "&::-ms-input-placeholder": r,
        "&:focus::-webkit-input-placeholder": i,
        "&:focus::-moz-placeholder": i,
        "&:focus:-ms-input-placeholder": i,
        "&:focus::-ms-input-placeholder": i
      }
    },
    inputDense: {
      paddingTop: e.spacing.unit / 2 - 1
    },
    inputDisabled: {
      opacity: 1
    },
    inputType: {
      height: "1.1875em"
    },
    inputMultiline: {
      resize: "none",
      padding: 0
    },
    inputSearch: {
      "-moz-appearance": "textfield",
      "-webkit-appearance": "textfield"
    }
  };
};
function _(e, t) {
  var n = e.disabled;
  var r = e.error;
  var i = e.margin;
  if (t && t.muiFormControl) {
    if (n === undefined) {
      n = t.muiFormControl.disabled;
    }
    if (r === undefined) {
      r = t.muiFormControl.error;
    }
    if (i === undefined) {
      i = t.muiFormControl.margin;
    }
  }
  return {
    disabled: n,
    error: r,
    margin: i
  };
}
var w = function (e) {
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
    r.state = {
      focused: false
    };
    r.input = null;
    r.handleFocus = function (e) {
      if (_(r.props, r.context).disabled) {
        e.stopPropagation();
      } else {
        r.setState({
          focused: true
        });
        if (r.props.onFocus) {
          r.props.onFocus(e);
        }
      }
    };
    r.handleBlur = function (e) {
      r.setState({
        focused: false
      });
      if (r.props.onBlur) {
        r.props.onBlur(e);
      }
    };
    r.handleChange = function (e) {
      if (!r.isControlled) {
        r.checkDirty(r.input);
      }
      if (r.props.onChange) {
        r.props.onChange(e);
      }
    };
    r.handleRefInput = function (e) {
      r.input = e;
      if (r.props.inputRef) {
        r.props.inputRef(e);
      } else if (r.props.inputProps && r.props.inputProps.ref) {
        r.props.inputProps.ref(e);
      }
    };
    i = n;
    return (0, u.default)(r, i);
  }
  (0, c.default)(t, e);
  (0, l.default)(t, [{
    key: "componentWillMount",
    value: function () {
      this.isControlled = this.props.value != null;
      if (this.isControlled) {
        this.checkDirty(this.props);
      }
    }
  }, {
    key: "componentDidMount",
    value: function () {
      if (!this.isControlled) {
        this.checkDirty(this.input);
      }
    }
  }, {
    key: "componentWillReceiveProps",
    value: function (e, t) {
      if (!_(this.props, this.context).disabled && _(e, t).disabled) {
        this.setState({
          focused: false
        });
      }
    }
  }, {
    key: "componentWillUpdate",
    value: function (e, t, n) {
      if (this.isControlled) {
        this.checkDirty(e);
      }
      if (!_(this.props, this.context).disabled && _(e, n).disabled) {
        var r = this.context.muiFormControl;
        if (r && r.onBlur) {
          r.onBlur();
        }
      }
    }
  }, {
    key: "checkDirty",
    value: function (e) {
      var t = this.context.muiFormControl;
      if (v(e)) {
        if (t && t.onDirty) {
          t.onDirty();
        }
        if (this.props.onDirty) {
          this.props.onDirty();
        }
        return;
      }
      if (t && t.onClean) {
        t.onClean();
      }
      if (this.props.onClean) {
        this.props.onClean();
      }
    }
  }, {
    key: "render",
    value: function () {
      var e;
      var t;
      var n = this.props;
      var a = n.autoComplete;
      var s = n.autoFocus;
      var l = n.classes;
      var u = n.className;
      var c = n.defaultValue;
      n.disabled;
      var f = n.disableUnderline;
      var h = n.endAdornment;
      n.error;
      var y = n.fullWidth;
      var g = n.id;
      var v = n.inputComponent;
      var b = n.inputProps;
      var w = (b = b === undefined ? {} : b).className;
      var x = (0, o.default)(b, ["className"]);
      n.inputRef;
      n.margin;
      var E = n.multiline;
      var S = n.name;
      n.onBlur;
      n.onChange;
      n.onClean;
      n.onDirty;
      n.onFocus;
      var T = n.onKeyDown;
      var k = n.onKeyUp;
      var O = n.placeholder;
      var P = n.readOnly;
      var C = n.rows;
      var I = n.rowsMax;
      var M = n.startAdornment;
      var L = n.type;
      var R = n.value;
      var A = (0, o.default)(n, ["autoComplete", "autoFocus", "classes", "className", "defaultValue", "disabled", "disableUnderline", "endAdornment", "error", "fullWidth", "id", "inputComponent", "inputProps", "inputRef", "margin", "multiline", "name", "onBlur", "onChange", "onClean", "onDirty", "onFocus", "onKeyDown", "onKeyUp", "placeholder", "readOnly", "rows", "rowsMax", "startAdornment", "type", "value"]);
      var D = this.context.muiFormControl;
      var N = _(this.props, this.context);
      var j = N.disabled;
      var F = N.error;
      var B = N.margin;
      var U = (0, p.default)(l.root, (e = {}, (0, i.default)(e, l.disabled, j), (0, i.default)(e, l.error, F), (0, i.default)(e, l.fullWidth, y), (0, i.default)(e, l.focused, this.state.focused), (0, i.default)(e, l.formControl, D), (0, i.default)(e, l.inkbar, !f), (0, i.default)(e, l.multiline, E), (0, i.default)(e, l.underline, !f), e), u);
      var z = (0, p.default)(l.input, (t = {}, (0, i.default)(t, l.inputDisabled, j), (0, i.default)(t, l.inputType, L !== "text"), (0, i.default)(t, l.inputMultiline, E), (0, i.default)(t, l.inputSearch, L === "search"), (0, i.default)(t, l.inputDense, B === "dense"), t), w);
      var H = D && D.required === true;
      var V = "input";
      var W = (0, r.default)({}, x, {
        ref: this.handleRefInput
      });
      if (v) {
        V = v;
        W = (0, r.default)({
          inputRef: this.handleRefInput
        }, W, {
          ref: null
        });
      } else if (E) {
        if (C && !I) {
          V = "textarea";
        } else {
          W = (0, r.default)({
            rowsMax: I,
            textareaRef: this.handleRefInput
          }, W, {
            ref: null
          });
          V = m.default;
        }
      }
      return d.default.createElement("div", (0, r.default)({
        onBlur: this.handleBlur,
        onFocus: this.handleFocus,
        className: U
      }, A), M, d.default.createElement(V, (0, r.default)({
        autoComplete: a,
        autoFocus: s,
        className: z,
        onChange: this.handleChange,
        onKeyUp: k,
        onKeyDown: T,
        disabled: j,
        required: !!H || undefined,
        value: R,
        id: g,
        name: S,
        defaultValue: c,
        placeholder: O,
        type: L,
        readOnly: P,
        rows: C,
        "aria-required": H,
        "aria-invalid": F
      }, W)), h);
    }
  }]);
  return t;
}(d.default.Component);
w.propTypes = {};
w.muiName = "Input";
w.defaultProps = {
  disableUnderline: false,
  fullWidth: false,
  multiline: false,
  type: "text"
};
w.contextTypes = {
  muiFormControl: f.default.object
};
exports.default = (0, h.default)(b, {
  name: "MuiInput"
})(w);