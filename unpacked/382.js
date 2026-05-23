Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = p(require("./3.js"));
var i = p(require("./4.js"));
var o = p(require("./10.js"));
var a = p(require("./9.js"));
var s = p(require("./11.js"));
var l = p(require("./12.js"));
var u = p(require("./13.js"));
exports.getScale = h;
var c = p(require("./0.js"));
p(require("./1.js"));
var d = p(require("./867.js"));
var f = p(require("./87.js"));
function p(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function h(e) {
  return "scale(" + e + ", " + Math.pow(e, 2) + ")";
}
var m = function (e) {
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
    r.autoTimeout = undefined;
    r.handleEnter = function (e) {
      e.style.opacity = "0";
      e.style.transform = h(0.75);
      if (r.props.onEnter) {
        r.props.onEnter(e);
      }
    };
    r.handleEntering = function (e) {
      var t = r.props;
      var n = t.theme;
      var i = t.timeout;
      var o = 0;
      if (i === "auto") {
        o = n.transitions.getAutoHeightDuration(e.clientHeight);
        r.autoTimeout = o;
      } else if (typeof i == "number") {
        o = i;
      } else if (i && typeof i.enter == "number") {
        o = i.enter;
      }
      e.style.transition = [n.transitions.create("opacity", {
        duration: o
      }), n.transitions.create("transform", {
        duration: o * 0.666
      })].join(",");
      e.style.opacity = "1";
      e.style.transform = h(1);
      if (r.props.onEntering) {
        r.props.onEntering(e);
      }
    };
    r.handleExit = function (e) {
      var t = r.props;
      var n = t.theme;
      var i = t.timeout;
      var o = 0;
      if (i === "auto") {
        o = n.transitions.getAutoHeightDuration(e.clientHeight);
        r.autoTimeout = o;
      } else if (typeof i == "number") {
        o = i;
      } else if (i && typeof i.exit == "number") {
        o = i.exit;
      }
      e.style.transition = [n.transitions.create("opacity", {
        duration: o
      }), n.transitions.create("transform", {
        duration: o * 0.666,
        delay: o * 0.333
      })].join(",");
      e.style.opacity = "0";
      e.style.transform = h(0.75);
      if (r.props.onExit) {
        r.props.onExit(e);
      }
    };
    r.addEndListener = function (e, t) {
      if (r.props.timeout === "auto") {
        setTimeout(t, r.autoTimeout || 0);
      }
    };
    i = n;
    return (0, l.default)(r, i);
  }
  (0, u.default)(t, e);
  (0, s.default)(t, [{
    key: "render",
    value: function () {
      var e = this.props;
      var t = e.appear;
      var n = e.children;
      e.onEnter;
      e.onEntering;
      e.onExit;
      var o = e.style;
      e.theme;
      var a = e.timeout;
      var s = e.transitionClasses;
      var l = s === undefined ? {} : s;
      var u = (0, i.default)(e, ["appear", "children", "onEnter", "onEntering", "onExit", "style", "theme", "timeout", "transitionClasses"]);
      var f = {};
      if (!this.props.in || !!t) {
        f.opacity = "0";
      }
      f = (0, r.default)({}, f, o, c.default.isValidElement(n) ? n.props.style : {});
      return c.default.createElement(d.default, (0, r.default)({
        classNames: l,
        onEnter: this.handleEnter,
        onEntering: this.handleEntering,
        onExit: this.handleExit,
        addEndListener: this.addEndListener,
        appear: t,
        style: f,
        timeout: a === "auto" ? null : a
      }, u), n);
    }
  }]);
  return t;
}(c.default.Component);
m.propTypes = {};
m.defaultProps = {
  appear: true,
  timeout: "auto"
};
exports.default = (0, f.default)()(m);