Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = _(require("./4.js"));
var i = _(require("./10.js"));
var o = _(require("./9.js"));
var a = _(require("./11.js"));
var s = _(require("./12.js"));
var l = _(require("./13.js"));
var u = _(require("./6.js"));
var c = _(require("./3.js"));
var d = _(require("./0.js"));
_(require("./1.js"));
var f = _(require("./5.js"));
var p = _(require("./44.js"));
var h = _(require("./2.js"));
var m = require("./43.js");
var y = _(require("./238.js"));
var g = require("./20.js");
var v = _(require("./123.js"));
var b = _(require("./359.js"));
function _(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var w = exports.styles = function (e) {
  var t = e.spacing.unit * 3;
  var n = {
    top: 0
  };
  var r = {
    bottom: 0
  };
  var i = {
    justifyContent: "flex-end"
  };
  var o = {
    justifyContent: "flex-start"
  };
  var a = {
    top: t
  };
  var s = {
    bottom: t
  };
  var l = {
    right: t
  };
  var d = {
    left: t
  };
  var f = {
    left: "50%",
    right: "auto",
    transform: "translateX(-50%)"
  };
  return {
    root: {
      zIndex: e.zIndex.snackbar,
      position: "fixed",
      display: "flex",
      left: 0,
      right: 0,
      justifyContent: "center",
      alignItems: "center"
    },
    anchorTopCenter: (0, c.default)({}, n, (0, u.default)({}, e.breakpoints.up("md"), (0, c.default)({}, f))),
    anchorBottomCenter: (0, c.default)({}, r, (0, u.default)({}, e.breakpoints.up("md"), (0, c.default)({}, f))),
    anchorTopRight: (0, c.default)({}, n, i, (0, u.default)({}, e.breakpoints.up("md"), (0, c.default)({
      left: "auto"
    }, a, l))),
    anchorBottomRight: (0, c.default)({}, r, i, (0, u.default)({}, e.breakpoints.up("md"), (0, c.default)({
      left: "auto"
    }, s, l))),
    anchorTopLeft: (0, c.default)({}, n, o, (0, u.default)({}, e.breakpoints.up("md"), (0, c.default)({
      right: "auto"
    }, a, d))),
    anchorBottomLeft: (0, c.default)({}, r, o, (0, u.default)({}, e.breakpoints.up("md"), (0, c.default)({
      right: "auto"
    }, s, d)))
  };
};
var x = function (e) {
  function t() {
    var e;
    var n;
    var r;
    var a;
    (0, o.default)(this, t);
    for (var l = arguments.length, u = Array(l), c = 0; c < l; c++) {
      u[c] = arguments[c];
    }
    n = r = (0, s.default)(this, (e = t.__proto__ || (0, i.default)(t)).call.apply(e, [this].concat(u)));
    r.state = {
      exited: false
    };
    r.timerAutoHide = null;
    r.handleMouseEnter = function (e) {
      if (r.props.onMouseEnter) {
        r.props.onMouseEnter(e);
      }
      r.handlePause();
    };
    r.handleMouseLeave = function (e) {
      if (r.props.onMouseLeave) {
        r.props.onMouseLeave(e);
      }
      r.handleResume();
    };
    r.handleClickAway = function (e) {
      if (r.props.onClose) {
        r.props.onClose(e, "clickaway");
      }
    };
    r.handlePause = function () {
      clearTimeout(r.timerAutoHide);
    };
    r.handleResume = function () {
      if (r.props.autoHideDuration != null) {
        if (r.props.resumeHideDuration !== undefined) {
          r.setAutoHideTimer(r.props.resumeHideDuration);
          return;
        }
        r.setAutoHideTimer((r.props.autoHideDuration || 0) * 0.5);
      }
    };
    r.handleExited = function () {
      r.setState({
        exited: true
      });
    };
    a = n;
    return (0, s.default)(r, a);
  }
  (0, l.default)(t, e);
  (0, a.default)(t, [{
    key: "componentWillMount",
    value: function () {
      if (!this.props.open) {
        this.setState({
          exited: true
        });
      }
    }
  }, {
    key: "componentDidMount",
    value: function () {
      if (this.props.open) {
        this.setAutoHideTimer();
      }
    }
  }, {
    key: "componentWillReceiveProps",
    value: function (e) {
      if (e.open) {
        this.setState({
          exited: false
        });
      }
    }
  }, {
    key: "componentDidUpdate",
    value: function (e) {
      if (e.open !== this.props.open) {
        if (this.props.open) {
          this.setAutoHideTimer();
        } else {
          clearTimeout(this.timerAutoHide);
        }
      }
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      clearTimeout(this.timerAutoHide);
    }
  }, {
    key: "setAutoHideTimer",
    value: function () {
      var e = this;
      var t = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      if (this.props.onClose && this.props.autoHideDuration != null) {
        clearTimeout(this.timerAutoHide);
        this.timerAutoHide = setTimeout(function () {
          if (e.props.onClose && e.props.autoHideDuration != null) {
            e.props.onClose(null, "timeout");
          }
        }, t || this.props.autoHideDuration || 0);
      }
    }
  }, {
    key: "render",
    value: function () {
      var e = this.props;
      var t = e.action;
      var n = e.anchorOrigin;
      var i = n.vertical;
      var o = n.horizontal;
      e.autoHideDuration;
      var a = e.children;
      var s = e.classes;
      var l = e.className;
      var u = e.message;
      e.onClose;
      var h = e.onEnter;
      var m = e.onEntered;
      var _ = e.onEntering;
      var w = e.onExit;
      var x = e.onExited;
      var E = e.onExiting;
      e.onMouseEnter;
      e.onMouseLeave;
      var S = e.open;
      e.resumeHideDuration;
      var T = e.SnackbarContentProps;
      var k = e.transition;
      var O = e.transitionDuration;
      var P = (0, r.default)(e, ["action", "anchorOrigin", "autoHideDuration", "children", "classes", "className", "message", "onClose", "onEnter", "onEntered", "onEntering", "onExit", "onExited", "onExiting", "onMouseEnter", "onMouseLeave", "open", "resumeHideDuration", "SnackbarContentProps", "transition", "transitionDuration"]);
      if (!S && this.state.exited) {
        return null;
      }
      var C = {};
      if (k === v.default) {
        C.direction = i === "top" ? "down" : "up";
      }
      return d.default.createElement(p.default, {
        target: "window",
        onFocus: this.handleResume,
        onBlur: this.handlePause
      }, d.default.createElement(y.default, {
        onClickAway: this.handleClickAway
      }, d.default.createElement("div", (0, c.default)({
        className: (0, f.default)(s.root, s["anchor" + (0, g.capitalize)(i) + (0, g.capitalize)(o)], l),
        onMouseEnter: this.handleMouseEnter,
        onMouseLeave: this.handleMouseLeave
      }, P), d.default.createElement(k, (0, c.default)({
        appear: true,
        in: S,
        onEnter: h,
        onEntered: m,
        onEntering: _,
        onExit: w,
        onExited: (0, g.createChainedFunction)(this.handleExited, x),
        onExiting: E,
        timeout: O
      }, C), a || d.default.createElement(b.default, (0, c.default)({
        message: u,
        action: t
      }, T))))));
    }
  }]);
  return t;
}(d.default.Component);
x.propTypes = {};
x.defaultProps = {
  anchorOrigin: {
    vertical: "bottom",
    horizontal: "center"
  },
  transition: v.default,
  transitionDuration: {
    enter: m.duration.enteringScreen,
    exit: m.duration.leavingScreen
  }
};
exports.default = (0, h.default)(w, {
  flip: false,
  name: "MuiSnackbar"
})(x);