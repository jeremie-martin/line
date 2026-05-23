Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = g(require("./3.js"));
var i = g(require("./6.js"));
var o = g(require("./4.js"));
var a = g(require("./10.js"));
var s = g(require("./9.js"));
var l = g(require("./11.js"));
var u = g(require("./12.js"));
var c = g(require("./13.js"));
var d = g(require("./0.js"));
var f = g(require("./1.js"));
var p = g(require("./5.js"));
var h = g(require("./2.js"));
var m = require("./250.js");
var y = require("./45.js");
function g(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var v = exports.styles = function (e) {
  return {
    root: {
      display: "inline-flex",
      flexDirection: "column",
      position: "relative",
      minWidth: 0,
      padding: 0,
      margin: 0,
      border: 0
    },
    marginNormal: {
      marginTop: e.spacing.unit * 2,
      marginBottom: e.spacing.unit
    },
    marginDense: {
      marginTop: e.spacing.unit,
      marginBottom: e.spacing.unit / 2
    },
    fullWidth: {
      width: "100%"
    }
  };
};
var b = function (e) {
  function t(e, n) {
    (0, s.default)(this, t);
    var r = (0, u.default)(this, (t.__proto__ || (0, a.default)(t)).call(this, e, n));
    r.state = {
      adornedStart: false,
      dirty: false,
      focused: false
    };
    r.handleFocus = function (e) {
      if (r.props.onFocus) {
        r.props.onFocus(e);
      }
      r.setState(function (e) {
        if (e.focused) {
          return null;
        } else {
          return {
            focused: true
          };
        }
      });
    };
    r.handleBlur = function (e) {
      if (r.props.onBlur && e) {
        r.props.onBlur(e);
      }
      r.setState(function (e) {
        if (e.focused) {
          return {
            focused: false
          };
        } else {
          return null;
        }
      });
    };
    r.handleDirty = function () {
      if (!r.state.dirty) {
        r.setState({
          dirty: true
        });
      }
    };
    r.handleClean = function () {
      if (r.state.dirty) {
        r.setState({
          dirty: false
        });
      }
    };
    var i = r.props.children;
    if (i) {
      d.default.Children.forEach(i, function (e) {
        if ((0, y.isMuiElement)(e, ["Input", "Select"]) && (0, m.isDirty)(e.props, true)) {
          r.state.dirty = true;
        }
        if ((0, y.isMuiElement)(e, ["Input"]) && (0, m.isAdornedStart)(e.props)) {
          r.state.adornedStart = true;
        }
      });
    }
    return r;
  }
  (0, c.default)(t, e);
  (0, l.default)(t, [{
    key: "getChildContext",
    value: function () {
      var e = this.props;
      var t = e.disabled;
      var n = e.error;
      var r = e.required;
      var i = e.margin;
      var o = this.state;
      return {
        muiFormControl: {
          adornedStart: o.adornedStart,
          dirty: o.dirty,
          disabled: t,
          error: n,
          focused: o.focused,
          margin: i,
          required: r,
          onDirty: this.handleDirty,
          onClean: this.handleClean,
          onFocus: this.handleFocus,
          onBlur: this.handleBlur
        }
      };
    }
  }, {
    key: "render",
    value: function () {
      var e;
      var t = this.props;
      var n = t.classes;
      var a = t.className;
      var s = t.component;
      t.disabled;
      t.error;
      var l = t.fullWidth;
      var u = t.margin;
      t.required;
      var c = (0, o.default)(t, ["classes", "className", "component", "disabled", "error", "fullWidth", "margin", "required"]);
      return d.default.createElement(s, (0, r.default)({
        className: (0, p.default)(n.root, (e = {}, (0, i.default)(e, n.marginNormal, u === "normal"), (0, i.default)(e, n.marginDense, u === "dense"), (0, i.default)(e, n.fullWidth, l), e), a)
      }, c, {
        onFocus: this.handleFocus,
        onBlur: this.handleBlur
      }));
    }
  }]);
  return t;
}(d.default.Component);
b.propTypes = {};
b.defaultProps = {
  component: "div",
  disabled: false,
  error: false,
  fullWidth: false,
  margin: "none",
  required: false
};
b.childContextTypes = {
  muiFormControl: f.default.object.isRequired
};
exports.default = (0, h.default)(v, {
  name: "MuiFormControl"
})(b);