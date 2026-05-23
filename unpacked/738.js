Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = exports.DELAY_RIPPLE = undefined;
var r = g(require("./3.js"));
var i = g(require("./4.js"));
var o = g(require("./126.js"));
var a = g(require("./10.js"));
var s = g(require("./9.js"));
var l = g(require("./11.js"));
var u = g(require("./12.js"));
var c = g(require("./13.js"));
var d = g(require("./0.js"));
g(require("./1.js"));
var f = g(require("./21.js"));
var p = g(require("./239.js"));
var h = g(require("./5.js"));
var m = g(require("./2.js"));
var y = g(require("./745.js"));
function g(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var v = 550;
var b = exports.DELAY_RIPPLE = 80;
var _ = exports.styles = function (e) {
  return {
    root: {
      display: "block",
      position: "absolute",
      overflow: "hidden",
      borderRadius: "inherit",
      width: "100%",
      height: "100%",
      left: 0,
      top: 0,
      pointerEvents: "none",
      zIndex: 0
    },
    wrapper: {
      opacity: 1
    },
    wrapperLeaving: {
      opacity: 0,
      animation: "mui-ripple-exit " + v + "ms " + e.transitions.easing.easeInOut
    },
    wrapperPulsating: {
      position: "absolute",
      left: 0,
      top: 0,
      display: "block",
      width: "100%",
      height: "100%",
      animation: "mui-ripple-pulsate 2500ms " + e.transitions.easing.easeInOut + " 200ms infinite"
    },
    "@keyframes mui-ripple-enter": {
      "0%": {
        transform: "scale(0)"
      },
      "100%": {
        transform: "scale(1)"
      }
    },
    "@keyframes mui-ripple-exit": {
      "0%": {
        opacity: 1
      },
      "100%": {
        opacity: 0
      }
    },
    "@keyframes mui-ripple-pulsate": {
      "0%": {
        transform: "scale(1)"
      },
      "50%": {
        transform: "scale(0.92)"
      },
      "100%": {
        transform: "scale(1)"
      }
    },
    ripple: {
      width: 50,
      height: 50,
      left: 0,
      top: 0,
      opacity: 0,
      position: "absolute",
      borderRadius: "50%",
      background: "currentColor"
    },
    rippleVisible: {
      opacity: 0.3,
      transform: "scale(1)",
      animation: "mui-ripple-enter " + v + "ms " + e.transitions.easing.easeInOut
    },
    rippleFast: {
      animationDuration: "200ms"
    }
  };
};
var w = function (e) {
  function t() {
    var e;
    var n;
    var r;
    var i;
    (0, s.default)(this, t);
    for (var l = arguments.length, c = Array(l), p = 0; p < l; p++) {
      c[p] = arguments[p];
    }
    n = r = (0, u.default)(this, (e = t.__proto__ || (0, a.default)(t)).call.apply(e, [this].concat(c)));
    r.state = {
      nextKey: 0,
      ripples: []
    };
    r.ignoringMouseDown = false;
    r.startTimer = null;
    r.startTimerCommit = null;
    r.pulsate = function () {
      r.start({}, {
        pulsate: true
      });
    };
    r.start = function (e = {}, t = {}) {
      var n = arguments[2];
      var i = t.pulsate;
      var o = i !== undefined && i;
      var a = t.center;
      var s = a === undefined ? r.props.center || t.pulsate : a;
      var l = t.fakeElement;
      var u = l !== undefined && l;
      if (e.type === "mousedown" && r.ignoringMouseDown) {
        r.ignoringMouseDown = false;
      } else {
        if (e.type === "touchstart") {
          r.ignoringMouseDown = true;
        }
        var c = u ? null : f.default.findDOMNode(r);
        var d = c ? c.getBoundingClientRect() : {
          width: 0,
          height: 0,
          left: 0,
          top: 0
        };
        var p = undefined;
        var h = undefined;
        var m = undefined;
        if (s || e.clientX === 0 && e.clientY === 0 || !e.clientX && !e.touches) {
          p = Math.round(d.width / 2);
          h = Math.round(d.height / 2);
        } else {
          var y = e.clientX ? e.clientX : e.touches[0].clientX;
          var g = e.clientY ? e.clientY : e.touches[0].clientY;
          p = Math.round(y - d.left);
          h = Math.round(g - d.top);
        }
        if (s) {
          if ((m = Math.sqrt((Math.pow(d.width, 2) * 2 + Math.pow(d.height, 2)) / 3)) % 2 == 0) {
            m += 1;
          }
        } else {
          var v = Math.max(Math.abs((c ? c.clientWidth : 0) - p), p) * 2 + 2;
          var _ = Math.max(Math.abs((c ? c.clientHeight : 0) - h), h) * 2 + 2;
          m = Math.sqrt(Math.pow(v, 2) + Math.pow(_, 2));
        }
        if (e.touches) {
          r.startTimerCommit = function () {
            r.startCommit({
              pulsate: o,
              rippleX: p,
              rippleY: h,
              rippleSize: m,
              cb: n
            });
          };
          r.startTimer = setTimeout(function () {
            r.startTimerCommit();
            r.startTimerCommit = null;
          }, b);
        } else {
          r.startCommit({
            pulsate: o,
            rippleX: p,
            rippleY: h,
            rippleSize: m,
            cb: n
          });
        }
      }
    };
    r.startCommit = function (e) {
      var t = e.pulsate;
      var n = e.rippleX;
      var i = e.rippleY;
      var a = e.rippleSize;
      var s = e.cb;
      var l = r.state.ripples;
      l = [].concat((0, o.default)(l), [d.default.createElement(y.default, {
        key: r.state.nextKey,
        classes: r.props.classes,
        timeout: {
          exit: v,
          enter: v
        },
        pulsate: t,
        rippleX: n,
        rippleY: i,
        rippleSize: a
      })]);
      r.setState({
        nextKey: r.state.nextKey + 1,
        ripples: l
      }, s);
    };
    r.stop = function (e, t) {
      clearTimeout(r.startTimer);
      var n = r.state.ripples;
      if (e.type === "touchend" && r.startTimerCommit) {
        e.persist();
        r.startTimerCommit();
        r.startTimerCommit = null;
        r.startTimer = setTimeout(function () {
          r.stop(e, t);
        }, 0);
        return;
      }
      r.startTimerCommit = null;
      if (n && n.length) {
        r.setState({
          ripples: n.slice(1)
        }, t);
      }
    };
    i = n;
    return (0, u.default)(r, i);
  }
  (0, c.default)(t, e);
  (0, l.default)(t, [{
    key: "componentWillUnmount",
    value: function () {
      clearTimeout(this.startTimer);
    }
  }, {
    key: "render",
    value: function () {
      var e = this.props;
      e.center;
      var t = e.classes;
      var n = e.className;
      var o = (0, i.default)(e, ["center", "classes", "className"]);
      return d.default.createElement(p.default, (0, r.default)({
        component: "span",
        enter: true,
        exit: true,
        className: (0, h.default)(t.root, n)
      }, o), this.state.ripples);
    }
  }]);
  return t;
}(d.default.Component);
w.propTypes = {};
w.defaultProps = {
  center: false
};
exports.default = (0, m.default)(_, {
  flip: false,
  name: "MuiTouchRipple"
})(w);