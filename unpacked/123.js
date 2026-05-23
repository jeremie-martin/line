Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = g(require("./3.js"));
var i = g(require("./4.js"));
var o = g(require("./10.js"));
var a = g(require("./9.js"));
var s = g(require("./11.js"));
var l = g(require("./12.js"));
var u = g(require("./13.js"));
exports.setTranslateValue = b;
var c = g(require("./0.js"));
g(require("./1.js"));
var d = require("./21.js");
var f = g(require("./44.js"));
var p = g(require("./56.js"));
var h = g(require("./89.js"));
var m = g(require("./87.js"));
var y = require("./43.js");
function g(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var v = 24;
function b(e, t) {
  var n = function (e, t) {
    var n = e.direction;
    var r = t.getBoundingClientRect();
    var i = undefined;
    if (t.fakeTransform) {
      i = t.fakeTransform;
    } else {
      var o = window.getComputedStyle(t);
      i = o.getPropertyValue("-webkit-transform") || o.getPropertyValue("transform");
    }
    var a = 0;
    var s = 0;
    if (i && i !== "none" && typeof i == "string") {
      var l = i.split("(")[1].split(")")[0].split(",");
      a = parseInt(l[4], 10);
      s = parseInt(l[5], 10);
    }
    if (n === "left") {
      return "translateX(100vw) translateX(-" + (r.left - a) + "px)";
    } else if (n === "right") {
      return "translateX(-" + (r.left + r.width + v - a) + "px)";
    } else if (n === "up") {
      return "translateY(100vh) translateY(-" + (r.top - s) + "px)";
    } else {
      return "translate3d(0, " + (0 - (r.top + r.height)) + "px, 0)";
    }
  }(e, t);
  if (n) {
    t.style.transform = n;
    t.style.webkitTransform = n;
  }
}
function _(e) {
  return e.scrollTop;
}
var w = function (e) {
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
      mounted: false
    };
    r.transition = null;
    r.handleResize = (0, p.default)(function () {
      if (!r.props.in && r.props.direction !== "down" && r.props.direction !== "right") {
        var e = (0, d.findDOMNode)(r.transition);
        if (e instanceof HTMLElement) {
          b(r.props, e);
        }
      }
    }, 166);
    r.handleEnter = function (e) {
      b(r.props, e);
      _(e);
      if (r.props.onEnter) {
        r.props.onEnter(e);
      }
    };
    r.handleEntering = function (e) {
      var t = r.props;
      var n = t.theme;
      var i = t.timeout;
      e.style.transition = n.transitions.create("transform", {
        duration: typeof i == "number" ? i : i.enter,
        easing: n.transitions.easing.easeOut
      });
      e.style.webkitTransition = n.transitions.create("-webkit-transform", {
        duration: typeof i == "number" ? i : i.enter,
        easing: n.transitions.easing.easeOut
      });
      e.style.transform = "translate3d(0, 0, 0)";
      e.style.webkitTransform = "translate3d(0, 0, 0)";
      if (r.props.onEntering) {
        r.props.onEntering(e);
      }
    };
    r.handleExit = function (e) {
      var t = r.props;
      var n = t.theme;
      var i = t.timeout;
      e.style.transition = n.transitions.create("transform", {
        duration: typeof i == "number" ? i : i.exit,
        easing: n.transitions.easing.sharp
      });
      e.style.webkitTransition = n.transitions.create("-webkit-transform", {
        duration: typeof i == "number" ? i : i.exit,
        easing: n.transitions.easing.sharp
      });
      b(r.props, e);
      if (r.props.onExit) {
        r.props.onExit(e);
      }
    };
    r.handleExited = function (e) {
      e.style.transition = "";
      e.style.webkitTransition = "";
      if (r.props.onExited) {
        r.props.onExited(e);
      }
    };
    i = n;
    return (0, l.default)(r, i);
  }
  (0, u.default)(t, e);
  (0, s.default)(t, [{
    key: "componentDidMount",
    value: function () {
      if (!this.props.in) {
        this.updatePosition();
      }
    }
  }, {
    key: "componentWillReceiveProps",
    value: function () {
      this.setState({
        mounted: true
      });
    }
  }, {
    key: "componentDidUpdate",
    value: function (e) {
      if (e.direction !== this.props.direction && !this.props.in) {
        this.updatePosition();
      }
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      this.handleResize.cancel();
    }
  }, {
    key: "updatePosition",
    value: function () {
      var e = (0, d.findDOMNode)(this.transition);
      if (e instanceof HTMLElement) {
        e.style.visibility = "inherit";
        b(this.props, e);
      }
    }
  }, {
    key: "render",
    value: function () {
      var e = this;
      var t = this.props;
      var n = t.children;
      t.onEnter;
      t.onEntering;
      t.onExit;
      t.onExited;
      var o = t.style;
      t.theme;
      var a = (0, i.default)(t, ["children", "onEnter", "onEntering", "onExit", "onExited", "style", "theme"]);
      var s = {};
      if (!this.props.in && !this.state.mounted) {
        s.visibility = "hidden";
      }
      s = (0, r.default)({}, s, o, c.default.isValidElement(n) ? n.props.style : {});
      return c.default.createElement(f.default, {
        target: "window",
        onResize: this.handleResize
      }, c.default.createElement(h.default, (0, r.default)({
        onEnter: this.handleEnter,
        onEntering: this.handleEntering,
        onExit: this.handleExit,
        onExited: this.handleExited,
        appear: true,
        style: s,
        ref: function (t) {
          e.transition = t;
        }
      }, a), n));
    }
  }]);
  return t;
}(c.default.Component);
w.propTypes = {};
w.defaultProps = {
  timeout: {
    enter: y.duration.enteringScreen,
    exit: y.duration.leavingScreen
  }
};
exports.default = (0, m.default)()(w);