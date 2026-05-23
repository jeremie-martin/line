Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = b(require("./3.js"));
var i = b(require("./6.js"));
var o = b(require("./4.js"));
var a = b(require("./10.js"));
var s = b(require("./9.js"));
var l = b(require("./11.js"));
var u = b(require("./12.js"));
var c = b(require("./13.js"));
var d = b(require("./0.js"));
b(require("./1.js"));
var f = require("./21.js");
var p = b(require("./5.js"));
var h = b(require("./91.js"));
var m = b(require("./2.js"));
var y = require("./737.js");
var g = b(require("./738.js"));
var v = b(require("./746.js"));
function b(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var _ = exports.styles = {
  root: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    WebkitTapHighlightColor: "transparent",
    backgroundColor: "transparent",
    outline: "none",
    border: 0,
    margin: 0,
    borderRadius: 0,
    padding: 0,
    cursor: "pointer",
    userSelect: "none",
    verticalAlign: "middle",
    "-moz-appearance": "none",
    "-webkit-appearance": "none",
    textDecoration: "none",
    color: "inherit",
    "&::-moz-focus-inner": {
      borderStyle: "none"
    }
  },
  disabled: {
    pointerEvents: "none",
    cursor: "default"
  }
};
var w = ["a"];
var x = function (e) {
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
      keyboardFocused: false
    };
    r.onKeyboardFocusHandler = function (e) {
      r.keyDown = false;
      r.setState({
        keyboardFocused: true
      });
      if (r.props.onKeyboardFocus) {
        r.props.onKeyboardFocus(e);
      }
    };
    r.onRippleRef = function (e) {
      r.ripple = e;
    };
    r.ripple = null;
    r.keyDown = false;
    r.button = null;
    r.keyboardFocusTimeout = null;
    r.keyboardFocusCheckTime = 50;
    r.keyboardFocusMaxCheckTimes = 5;
    r.handleKeyDown = function (e) {
      var t = r.props;
      var n = t.component;
      var i = t.focusRipple;
      var o = t.onKeyDown;
      var a = t.onClick;
      var s = (0, h.default)(e);
      if (i && !r.keyDown && r.state.keyboardFocused && s === "space") {
        r.keyDown = true;
        e.persist();
        r.ripple.stop(e, function () {
          r.ripple.start(e);
        });
      }
      if (o) {
        o(e);
      }
      if (e.target === r.button && a && n && n !== "a" && n !== "button" && (s === "space" || s === "enter")) {
        e.preventDefault();
        a(e);
      }
    };
    r.handleKeyUp = function (e) {
      if (r.props.focusRipple && (0, h.default)(e) === "space" && r.state.keyboardFocused) {
        r.keyDown = false;
        e.persist();
        r.ripple.stop(e, function () {
          return r.ripple.pulsate(e);
        });
      }
      if (r.props.onKeyUp) {
        r.props.onKeyUp(e);
      }
    };
    r.handleMouseDown = (0, v.default)(r, "MouseDown", "start", function () {
      clearTimeout(r.keyboardFocusTimeout);
      (0, y.focusKeyPressed)(false);
      if (r.state.keyboardFocused) {
        r.setState({
          keyboardFocused: false
        });
      }
    });
    r.handleMouseUp = (0, v.default)(r, "MouseUp", "stop");
    r.handleMouseLeave = (0, v.default)(r, "MouseLeave", "stop", function (e) {
      if (r.state.keyboardFocused) {
        e.preventDefault();
      }
    });
    r.handleTouchStart = (0, v.default)(r, "TouchStart", "start");
    r.handleTouchEnd = (0, v.default)(r, "TouchEnd", "stop");
    r.handleTouchMove = (0, v.default)(r, "TouchEnd", "stop");
    r.handleBlur = (0, v.default)(r, "Blur", "stop", function () {
      clearTimeout(r.keyboardFocusTimeout);
      (0, y.focusKeyPressed)(false);
      r.setState({
        keyboardFocused: false
      });
    });
    r.handleFocus = function (e) {
      if (!r.props.disabled) {
        r.button ||= e.currentTarget;
        e.persist();
        (0, y.detectKeyboardFocus)(r, r.button, function () {
          r.onKeyboardFocusHandler(e);
        });
        if (r.props.onFocus) {
          r.props.onFocus(e);
        }
      }
    };
    i = n;
    return (0, u.default)(r, i);
  }
  (0, c.default)(t, e);
  (0, l.default)(t, [{
    key: "componentDidMount",
    value: function () {
      this.button = (0, f.findDOMNode)(this);
      (0, y.listenForFocusKeys)();
    }
  }, {
    key: "componentWillReceiveProps",
    value: function (e) {
      if (!this.props.disabled && e.disabled && this.state.keyboardFocused) {
        this.setState({
          keyboardFocused: false
        });
      }
    }
  }, {
    key: "componentWillUpdate",
    value: function (e, t) {
      if (this.props.focusRipple && t.keyboardFocused && !this.state.keyboardFocused && !this.props.disableRipple) {
        this.ripple.pulsate();
      }
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      this.button = null;
      clearTimeout(this.keyboardFocusTimeout);
    }
  }, {
    key: "render",
    value: function () {
      var e;
      var t = this.props;
      var n = t.buttonRef;
      var a = t.centerRipple;
      var s = t.children;
      var l = t.classes;
      var u = t.className;
      var c = t.component;
      var f = t.disabled;
      var h = t.disableRipple;
      t.focusRipple;
      var m = t.keyboardFocusedClassName;
      t.onBlur;
      t.onFocus;
      t.onKeyboardFocus;
      t.onKeyDown;
      t.onKeyUp;
      t.onMouseDown;
      t.onMouseLeave;
      t.onMouseUp;
      t.onTouchEnd;
      t.onTouchMove;
      t.onTouchStart;
      var y = t.tabIndex;
      var v = t.type;
      var b = (0, o.default)(t, ["buttonRef", "centerRipple", "children", "classes", "className", "component", "disabled", "disableRipple", "focusRipple", "keyboardFocusedClassName", "onBlur", "onFocus", "onKeyboardFocus", "onKeyDown", "onKeyUp", "onMouseDown", "onMouseLeave", "onMouseUp", "onTouchEnd", "onTouchMove", "onTouchStart", "tabIndex", "type"]);
      var _ = (0, p.default)(l.root, (e = {}, (0, i.default)(e, l.disabled, f), (0, i.default)(e, m || "", this.state.keyboardFocused), e), u);
      var x = {};
      var E = c;
      E ||= b.href ? "a" : "button";
      if (E === "button") {
        x.type = v || "button";
        x.disabled = f;
      } else if (w.indexOf(E) === -1) {
        x.role = "button";
      }
      return d.default.createElement(E, (0, r.default)({
        onBlur: this.handleBlur,
        onFocus: this.handleFocus,
        onKeyDown: this.handleKeyDown,
        onKeyUp: this.handleKeyUp,
        onMouseDown: this.handleMouseDown,
        onMouseLeave: this.handleMouseLeave,
        onMouseUp: this.handleMouseUp,
        onTouchEnd: this.handleTouchEnd,
        onTouchMove: this.handleTouchMove,
        onTouchStart: this.handleTouchStart,
        tabIndex: f ? -1 : y,
        className: _,
        ref: n
      }, x, b), s, h || f ? null : d.default.createElement(g.default, {
        innerRef: this.onRippleRef,
        center: a
      }));
    }
  }]);
  return t;
}(d.default.Component);
x.propTypes = {};
x.defaultProps = {
  centerRipple: false,
  disableRipple: false,
  focusRipple: false,
  tabIndex: 0,
  type: "button"
};
exports.default = (0, m.default)(_, {
  name: "MuiButtonBase"
})(x);