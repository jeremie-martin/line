Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = g(require("./40.js"));
var i = g(require("./4.js"));
var o = g(require("./10.js"));
var a = g(require("./9.js"));
var s = g(require("./11.js"));
var l = g(require("./12.js"));
var u = g(require("./13.js"));
var c = g(require("./6.js"));
var d = g(require("./3.js"));
var f = g(require("./0.js"));
g(require("./1.js"));
var p = g(require("./5.js"));
var h = g(require("./2.js"));
var m = g(require("./32.js"));
var y = require("./20.js");
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
    root: (0, d.default)({}, e.typography.button, (0, c.default)({
      maxWidth: 264,
      position: "relative",
      minWidth: 72,
      padding: 0,
      height: 48,
      flex: "none",
      overflow: "hidden"
    }, e.breakpoints.up("md"), {
      minWidth: 160
    })),
    rootLabelIcon: {
      height: 72
    },
    rootInherit: {
      color: "inherit",
      opacity: 0.7
    },
    rootPrimary: {
      color: e.palette.text.secondary
    },
    rootPrimarySelected: {
      color: e.palette.primary.main
    },
    rootPrimaryDisabled: {
      color: e.palette.text.disabled
    },
    rootSecondary: {
      color: e.palette.text.secondary
    },
    rootSecondarySelected: {
      color: e.palette.secondary.main
    },
    rootSecondaryDisabled: {
      color: e.palette.text.disabled
    },
    rootInheritSelected: {
      opacity: 1
    },
    rootInheritDisabled: {
      opacity: 0.4
    },
    fullWidth: {
      flexGrow: 1
    },
    wrapper: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      flexDirection: "column"
    },
    labelContainer: (0, c.default)({
      paddingTop: 6,
      paddingBottom: 6,
      paddingLeft: 12,
      paddingRight: 12
    }, e.breakpoints.up("md"), {
      paddingLeft: e.spacing.unit * 3,
      paddingRight: e.spacing.unit * 3
    }),
    label: (0, c.default)({
      fontSize: e.typography.pxToRem(e.typography.fontSize),
      whiteSpace: "normal"
    }, e.breakpoints.up("md"), {
      fontSize: e.typography.pxToRem(e.typography.fontSize - 1)
    }),
    labelWrapped: (0, c.default)({}, e.breakpoints.down("sm"), {
      fontSize: e.typography.pxToRem(e.typography.fontSize - 2)
    })
  };
};
var b = function (e) {
  function t() {
    var e;
    var n;
    var r;
    var i;
    (0, a.default)(this, t);
    for (var s = arguments.length, u = Array(s), c = 0; c < s; c++) {
      u[c] = arguments[c];
    }
    n = r = (0, l.default)(this, (e = t.__proto__ || (0, o.default)(t)).call.apply(e, [this].concat(u)));
    r.state = {
      wrappedText: false
    };
    r.handleChange = function (e) {
      var t = r.props;
      var n = t.onChange;
      var i = t.value;
      var o = t.onClick;
      if (n) {
        n(e, i);
      }
      if (o) {
        o(e);
      }
    };
    r.label = undefined;
    r.checkTextWrap = function () {
      if (r.label) {
        var e = r.label.getClientRects().length > 1;
        if (r.state.wrappedText !== e) {
          r.setState({
            wrappedText: e
          });
        }
      }
    };
    i = n;
    return (0, l.default)(r, i);
  }
  (0, u.default)(t, e);
  (0, s.default)(t, [{
    key: "componentDidMount",
    value: function () {
      this.checkTextWrap();
    }
  }, {
    key: "componentDidUpdate",
    value: function (e, t) {
      if (this.state.wrappedText === t.wrappedText) {
        this.checkTextWrap();
      }
    }
  }, {
    key: "render",
    value: function () {
      var e;
      var t = this;
      var n = this.props;
      var o = n.classes;
      var a = n.className;
      var s = n.disabled;
      var l = n.fullWidth;
      var u = n.icon;
      var h = n.indicator;
      var g = n.label;
      n.onChange;
      var v = n.selected;
      var b = n.style;
      var _ = n.textColor;
      n.value;
      var w = (0, i.default)(n, ["classes", "className", "disabled", "fullWidth", "icon", "indicator", "label", "onChange", "selected", "style", "textColor", "value"]);
      var x = undefined;
      if (g !== undefined) {
        x = f.default.createElement("span", {
          className: o.labelContainer
        }, f.default.createElement("span", {
          className: (0, p.default)(o.label, (0, c.default)({}, o.labelWrapped, this.state.wrappedText)),
          ref: function (e) {
            t.label = e;
          }
        }, g));
      }
      var E = (0, p.default)(o.root, o["root" + (0, y.capitalize)(_)], (e = {}, (0, c.default)(e, o["root" + (0, y.capitalize)(_) + "Disabled"], s), (0, c.default)(e, o["root" + (0, y.capitalize)(_) + "Selected"], v), (0, c.default)(e, o.rootLabelIcon, u && x), (0, c.default)(e, o.fullWidth, l), e), a);
      var S = {};
      if (_ !== "secondary" && _ !== "inherit") {
        S.color = _;
      }
      S = (0, r.default)(S).length > 0 ? (0, d.default)({}, S, b) : b;
      return f.default.createElement(m.default, (0, d.default)({
        focusRipple: true,
        className: E,
        style: S,
        role: "tab",
        "aria-selected": v,
        disabled: s
      }, w, {
        onClick: this.handleChange
      }), f.default.createElement("span", {
        className: o.wrapper
      }, u, x), h);
    }
  }]);
  return t;
}(f.default.Component);
b.propTypes = {};
b.defaultProps = {
  disabled: false,
  textColor: "inherit"
};
exports.default = (0, h.default)(v, {
  name: "MuiTab"
})(b);