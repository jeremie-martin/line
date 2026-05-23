Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = w(require("./3.js"));
var i = w(require("./4.js"));
var o = w(require("./10.js"));
var a = w(require("./9.js"));
var s = w(require("./11.js"));
var l = w(require("./12.js"));
var u = w(require("./13.js"));
var c = w(require("./6.js"));
var d = w(require("./0.js"));
w(require("./1.js"));
var f = require("./21.js");
var p = w(require("./44.js"));
var h = w(require("./56.js"));
w(require("./14.js"));
var m = w(require("./5.js"));
var y = require("./958.js");
var g = require("./20.js");
var v = w(require("./378.js"));
var b = w(require("./236.js"));
var _ = w(require("./2.js"));
function w(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var x = exports.styles = function (e) {
  return {
    root: {
      display: "inline",
      flexDirection: "inherit"
    },
    popper: {
      zIndex: e.zIndex.tooltip
    },
    popperClose: {
      pointerEvents: "none"
    },
    tooltip: (0, c.default)({
      backgroundColor: e.palette.grey[700],
      borderRadius: 2,
      color: b.default.white,
      fontFamily: e.typography.fontFamily,
      opacity: 0,
      transform: "scale(0)",
      transition: e.transitions.create(["opacity", "transform"], {
        duration: e.transitions.duration.shortest
      }),
      minHeight: 0,
      padding: e.spacing.unit,
      fontSize: e.typography.pxToRem(14),
      lineHeight: e.typography.round(16 / 14) + "em"
    }, e.breakpoints.up("sm"), {
      padding: e.spacing.unit / 2 + "px " + e.spacing.unit + "px",
      fontSize: e.typography.pxToRem(10),
      lineHeight: e.typography.round(1.4) + "em"
    }),
    tooltipLeft: (0, c.default)({
      transformOrigin: "right center",
      margin: "0 " + e.spacing.unit * 3 + "px"
    }, e.breakpoints.up("sm"), {
      margin: "0 14px"
    }),
    tooltipRight: (0, c.default)({
      transformOrigin: "left center",
      margin: "0 " + e.spacing.unit * 3 + "px"
    }, e.breakpoints.up("sm"), {
      margin: "0 14px"
    }),
    tooltipTop: (0, c.default)({
      transformOrigin: "center bottom",
      margin: e.spacing.unit * 3 + "px 0"
    }, e.breakpoints.up("sm"), {
      margin: "14px 0"
    }),
    tooltipBottom: (0, c.default)({
      transformOrigin: "center top",
      margin: e.spacing.unit * 3 + "px 0"
    }, e.breakpoints.up("sm"), {
      margin: "14px 0"
    }),
    tooltipOpen: {
      opacity: 0.9,
      transform: "scale(1)"
    }
  };
};
var E = function (e) {
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
    r.state = {};
    r.enterTimer = null;
    r.leaveTimer = null;
    r.touchTimer = null;
    r.isControlled = null;
    r.popper = null;
    r.children = null;
    r.ignoreNonTouchEvents = false;
    r.handleResize = (0, h.default)(function () {
      if (r.popper) {
        r.popper._popper.scheduleUpdate();
      }
    }, 166);
    r.handleRequestOpen = function (e) {
      var t = r.props.children.props;
      if (e.type === "focus" && t.onFocus) {
        t.onFocus(e);
      }
      if (e.type === "mouseover" && t.onMouseOver) {
        t.onMouseOver(e);
      }
      if (!r.ignoreNonTouchEvents || e.type === "touchstart") {
        clearTimeout(r.leaveTimer);
        if (r.props.enterDelay > 0) {
          r.leaveTimer = setTimeout(function () {
            r.requestOpen(e);
          }, r.props.enterDelay);
        } else {
          r.requestOpen(e);
        }
      }
    };
    r.requestOpen = function (e) {
      if (!r.isControlled) {
        r.setState({
          open: true
        });
      }
      if (r.props.onOpen) {
        r.props.onOpen(e, true);
      }
    };
    r.handleClose = function (e) {
      var t = r.props.children.props;
      if (e.type === "blur" && t.onBlur) {
        t.onBlur(e);
      }
      if (e.type === "mouseleave" && t.onMouseLeave) {
        t.onMouseLeave(e);
      }
      clearTimeout(r.leaveTimer);
      if (r.props.leaveDelay) {
        r.leaveTimer = setTimeout(function () {
          r.requestClose(e);
        }, r.props.leaveDelay);
      } else {
        r.requestClose(e);
      }
    };
    r.requestClose = function (e) {
      r.ignoreNonTouchEvents = false;
      if (!r.isControlled) {
        r.setState({
          open: false
        });
      }
      if (r.props.onClose) {
        r.props.onClose(e, false);
      }
    };
    r.handleTouchStart = function (e) {
      r.ignoreNonTouchEvents = true;
      var t = r.props.children.props;
      if (t.onTouchStart) {
        t.onTouchStart(e);
      }
      clearTimeout(r.touchTimer);
      e.persist();
      r.touchTimer = setTimeout(function () {
        r.handleRequestOpen(e);
      }, 1000);
    };
    r.handleTouchEnd = function (e) {
      var t = r.props.children.props;
      if (t.onTouchEnd) {
        t.onTouchEnd(e);
      }
      clearTimeout(r.touchTimer);
      clearTimeout(r.leaveTimer);
      e.persist();
      r.leaveTimer = setTimeout(function () {
        r.requestClose(e);
      }, 1500 + r.props.leaveDelay);
    };
    i = n;
    return (0, l.default)(r, i);
  }
  (0, u.default)(t, e);
  (0, s.default)(t, [{
    key: "componentWillMount",
    value: function () {
      var e = this.props;
      this.isControlled = e.open != null;
      if (!this.isControlled) {
        this.setState({
          open: false
        });
      }
    }
  }, {
    key: "componentDidMount",
    value: function () {}
  }, {
    key: "componentWillUnmount",
    value: function () {
      clearTimeout(this.enterTimer);
      clearTimeout(this.leaveTimer);
      this.handleResize.cancel();
    }
  }, {
    key: "render",
    value: function () {
      var e = this;
      var t = this.props;
      var n = t.children;
      var o = t.classes;
      var a = t.className;
      var s = t.disableTriggerFocus;
      var l = t.disableTriggerHover;
      var u = t.disableTriggerTouch;
      t.enterDelay;
      var h = t.id;
      t.leaveDelay;
      t.onClose;
      t.onOpen;
      var b = t.open;
      var _ = t.placement;
      var w = t.PopperProps;
      var x = (w = w === undefined ? {} : w).PopperClassName;
      var E = (0, i.default)(w, ["PopperClassName"]);
      var S = t.theme;
      var T = t.title;
      var k = (0, i.default)(t, ["children", "classes", "className", "disableTriggerFocus", "disableTriggerHover", "disableTriggerTouch", "enterDelay", "id", "leaveDelay", "onClose", "onOpen", "open", "placement", "PopperProps", "theme", "title"]);
      var O = S.direction === "rtl" ? function (e) {
        switch (e) {
          case "bottom-end":
            return "bottom-start";
          case "bottom-start":
            return "bottom-end";
          case "top-end":
            return "top-start";
          case "top-start":
            return "top-end";
          default:
            return e;
        }
      }(_) : _;
      var P = this.isControlled ? b : this.state.open;
      var C = {};
      if (T === "") {
        P = false;
      }
      C["aria-describedby"] = h;
      if (!u) {
        C.onTouchStart = this.handleTouchStart;
        C.onTouchEnd = this.handleTouchEnd;
      }
      if (!l) {
        C.onMouseOver = this.handleRequestOpen;
        C.onMouseLeave = this.handleClose;
      }
      if (!s) {
        C.onFocus = this.handleRequestOpen;
        C.onBlur = this.handleClose;
      }
      return d.default.createElement(p.default, {
        target: "window",
        onResize: this.handleResize
      }, d.default.createElement(y.Manager, (0, r.default)({
        className: (0, m.default)(o.root, a)
      }, k), d.default.createElement(y.Target, null, function (t) {
        var r = t.targetProps;
        return d.default.createElement(v.default, {
          ref: function (t) {
            e.children = (0, f.findDOMNode)(t);
            r.ref(e.children);
          }
        }, d.default.cloneElement(n, C));
      }), d.default.createElement(y.Popper, (0, r.default)({
        placement: O,
        eventsEnabled: P,
        className: (0, m.default)(o.popper, (0, c.default)({}, o.popperClose, !P), x)
      }, E, {
        ref: function (t) {
          e.popper = t;
        }
      }), function (e) {
        var t = e.popperProps;
        var n = e.restProps;
        var i = t["data-placement"] || O;
        return d.default.createElement("div", (0, r.default)({}, t, n, {
          style: (0, r.default)({}, t.style, {
            top: t.style.top || 0,
            left: t.style.left || 0
          }, n.style)
        }), d.default.createElement("div", {
          id: h,
          role: "tooltip",
          "aria-hidden": !P,
          className: (0, m.default)(o.tooltip, (0, c.default)({}, o.tooltipOpen, P), o["tooltip" + (0, g.capitalize)(i.split("-")[0])])
        }, T));
      })));
    }
  }]);
  return t;
}(d.default.Component);
E.propTypes = {};
E.defaultProps = {
  disableTriggerFocus: false,
  disableTriggerHover: false,
  disableTriggerTouch: false,
  enterDelay: 0,
  leaveDelay: 0,
  placement: "bottom"
};
exports.default = (0, _.default)(x, {
  name: "MuiTooltip",
  withTheme: true
})(E);