Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = h(require("./3.js"));
var i = h(require("./4.js"));
var o = h(require("./10.js"));
var a = h(require("./9.js"));
var s = h(require("./11.js"));
var l = h(require("./12.js"));
var u = h(require("./13.js"));
var c = h(require("./0.js"));
h(require("./1.js"));
var d = h(require("./89.js"));
var f = require("./43.js");
var p = h(require("./87.js"));
function h(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function m(e) {
  return e.scrollTop;
}
var y = function (e) {
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
    r.handleEnter = function (e) {
      e.style.transform = "scale(0)";
      m(e);
      if (r.props.onEnter) {
        r.props.onEnter(e);
      }
    };
    r.handleEntering = function (e) {
      var t = r.props;
      var n = t.theme;
      var i = t.timeout;
      e.style.transition = n.transitions.create("transform", {
        duration: typeof i == "number" ? i : i.enter
      });
      e.style.webkitTransition = n.transitions.create("transform", {
        duration: typeof i == "number" ? i : i.enter
      });
      e.style.transform = "scale(1)";
      e.style.transitionDelay = r.props.enterDelay + "ms";
      if (r.props.onEntering) {
        r.props.onEntering(e);
      }
    };
    r.handleExit = function (e) {
      var t = r.props;
      var n = t.theme;
      var i = t.timeout;
      e.style.transition = n.transitions.create("transform", {
        duration: typeof i == "number" ? i : i.exit
      });
      e.style.webkitTransition = n.transitions.create("transform", {
        duration: typeof i == "number" ? i : i.exit
      });
      e.style.transform = "scale(0)";
      if (r.props.onExit) {
        r.props.onExit(e);
      }
    };
    i = n;
    return (0, l.default)(r, i);
  }
  (0, u.default)(t, e);
  (0, s.default)(t, [{
    key: "componentDidMount",
    value: function () {
      this.setState({
        mounted: true
      });
    }
  }, {
    key: "render",
    value: function () {
      var e = this.props;
      var t = e.appear;
      var n = e.children;
      e.enterDelay;
      e.onEnter;
      e.onEntering;
      e.onExit;
      var o = e.style;
      e.theme;
      var a = (0, i.default)(e, ["appear", "children", "enterDelay", "onEnter", "onEntering", "onExit", "style", "theme"]);
      var s = {};
      if (!this.props.in && !this.state.mounted && !!t) {
        s.transform = "scale(0)";
      }
      s = (0, r.default)({}, s, o, c.default.isValidElement(n) ? n.props.style : {});
      return c.default.createElement(d.default, (0, r.default)({
        appear: t,
        style: s,
        onEnter: this.handleEnter,
        onEntering: this.handleEntering,
        onExit: this.handleExit
      }, a), n);
    }
  }]);
  return t;
}(c.default.Component);
y.propTypes = {};
y.defaultProps = {
  appear: true,
  enterDelay: 0,
  timeout: {
    enter: f.duration.enteringScreen,
    exit: f.duration.leavingScreen
  }
};
exports.default = (0, p.default)()(y);