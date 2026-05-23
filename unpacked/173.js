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
var d = y(require("./0.js"));
var f = y(require("./5.js"));
y(require("./1.js"));
var p = y(require("./89.js"));
var h = y(require("./2.js"));
var m = require("./43.js");
function y(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var g = exports.styles = function (e) {
  return {
    container: {
      height: 0,
      overflow: "hidden",
      transition: e.transitions.create("height")
    },
    entered: {
      height: "auto"
    },
    wrapper: {
      display: "flex"
    },
    wrapperInner: {
      width: "100%"
    }
  };
};
var v = function (e) {
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
    r.wrapper = null;
    r.autoTransitionDuration = undefined;
    r.handleEnter = function (e) {
      e.style.height = r.props.collapsedHeight;
      if (r.props.onEnter) {
        r.props.onEnter(e);
      }
    };
    r.handleEntering = function (e) {
      var t = r.props;
      var n = t.timeout;
      var i = t.theme;
      var o = r.wrapper ? r.wrapper.clientHeight : 0;
      if (n === "auto") {
        var a = i.transitions.getAutoHeightDuration(o);
        e.style.transitionDuration = a + "ms";
        r.autoTransitionDuration = a;
      } else if (typeof n == "number") {
        e.style.transitionDuration = n + "ms";
      } else if (n && typeof n.enter == "number") {
        e.style.transitionDuration = n.enter + "ms";
      }
      e.style.height = o + "px";
      if (r.props.onEntering) {
        r.props.onEntering(e);
      }
    };
    r.handleEntered = function (e) {
      e.style.height = "auto";
      if (r.props.onEntered) {
        r.props.onEntered(e);
      }
    };
    r.handleExit = function (e) {
      var t = r.wrapper ? r.wrapper.clientHeight : 0;
      e.style.height = t + "px";
      if (r.props.onExit) {
        r.props.onExit(e);
      }
    };
    r.handleExiting = function (e) {
      var t = r.props;
      var n = t.timeout;
      var i = t.theme;
      var o = r.wrapper ? r.wrapper.clientHeight : 0;
      if (n === "auto") {
        var a = i.transitions.getAutoHeightDuration(o);
        e.style.transitionDuration = a + "ms";
        r.autoTransitionDuration = a;
      } else if (typeof n == "number") {
        e.style.transitionDuration = n + "ms";
      } else if (n && typeof n.exit == "number") {
        e.style.transitionDuration = n.exit + "ms";
      }
      e.style.height = r.props.collapsedHeight;
      if (r.props.onExiting) {
        r.props.onExiting(e);
      }
    };
    r.addEndListener = function (e, t) {
      if (r.props.timeout === "auto") {
        setTimeout(t, r.autoTransitionDuration || 0);
      }
    };
    i = n;
    return (0, u.default)(r, i);
  }
  (0, c.default)(t, e);
  (0, l.default)(t, [{
    key: "render",
    value: function () {
      var e = this;
      var t = this.props;
      var n = t.appear;
      var a = t.children;
      var s = t.classes;
      var l = t.className;
      var u = t.collapsedHeight;
      var c = t.component;
      t.onEnter;
      t.onEntered;
      t.onEntering;
      t.onExit;
      t.onExiting;
      var h = t.style;
      t.theme;
      var m = t.timeout;
      var y = (0, o.default)(t, ["appear", "children", "classes", "className", "collapsedHeight", "component", "onEnter", "onEntered", "onEntering", "onExit", "onExiting", "style", "theme", "timeout"]);
      return d.default.createElement(p.default, (0, r.default)({
        appear: n,
        onEntering: this.handleEntering,
        onEnter: this.handleEnter,
        onEntered: this.handleEntered,
        onExiting: this.handleExiting,
        onExit: this.handleExit,
        addEndListener: this.addEndListener,
        timeout: m === "auto" ? null : m
      }, y), function (t, n) {
        return d.default.createElement(c, (0, r.default)({
          className: (0, f.default)(s.container, (0, i.default)({}, s.entered, t === "entered"), l),
          style: (0, r.default)({}, h, {
            minHeight: u
          })
        }, n), d.default.createElement("div", {
          className: s.wrapper,
          ref: function (t) {
            e.wrapper = t;
          }
        }, d.default.createElement("div", {
          className: s.wrapperInner
        }, a)));
      });
    }
  }]);
  return t;
}(d.default.Component);
v.propTypes = {};
v.defaultProps = {
  appear: false,
  collapsedHeight: "0px",
  component: "div",
  timeout: m.duration.standard
};
exports.default = (0, h.default)(g, {
  withTheme: true,
  name: "MuiCollapse"
})(v);