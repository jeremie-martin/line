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
var c = w(require("./0.js"));
w(require("./1.js"));
var d = w(require("./21.js"));
w(require("./14.js"));
var f = w(require("./165.js"));
var p = w(require("./62.js"));
var h = w(require("./852.js"));
var m = w(require("./56.js"));
var y = w(require("./44.js"));
var g = w(require("./2.js"));
var v = w(require("./75.js"));
var b = w(require("./382.js"));
var _ = w(require("./37.js"));
function w(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function x(e, t) {
  var n = 0;
  if (typeof t == "number") {
    n = t;
  } else if (t === "center") {
    n = e.height / 2;
  } else if (t === "bottom") {
    n = e.height;
  }
  return n;
}
function E(e, t) {
  var n = 0;
  if (typeof t == "number") {
    n = t;
  } else if (t === "center") {
    n = e.width / 2;
  } else if (t === "right") {
    n = e.width;
  }
  return n;
}
var S = exports.styles = {
  paper: {
    position: "absolute",
    overflowY: "auto",
    overflowX: "hidden",
    minWidth: 16,
    minHeight: 16,
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "calc(100vh - 32px)",
    "&:focus": {
      outline: "none"
    }
  }
};
var T = function (e) {
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
    r.componentWillUnmount = function () {
      r.handleResize.cancel();
    };
    r.setPositioningStyles = function (e) {
      if (e && e.style) {
        var t = r.getPositioningStyle(e);
        e.style.top = t.top;
        e.style.left = t.left;
        e.style.transformOrigin = t.transformOrigin;
      }
    };
    r.getPositioningStyle = function (e) {
      var t = r.props;
      var n = t.anchorEl;
      var i = t.marginThreshold;
      var o = r.getContentAnchorOffset(e);
      var a = r.getAnchorOffset(o);
      var s = {
        width: e.clientWidth,
        height: e.clientHeight
      };
      var l = r.getTransformOrigin(s, o);
      var u = a.top - l.vertical;
      var c = a.left - l.horizontal;
      var d = u + s.height;
      var f = c + s.width;
      var p = (0, h.default)(n);
      var m = p.innerHeight - i;
      var y = p.innerWidth - i;
      if (u < i) {
        var g = u - i;
        u -= g;
        l.vertical += g;
      } else if (d > m) {
        var v = d - m;
        u -= v;
        l.vertical += v;
      }
      if (c < i) {
        var b = c - i;
        c -= b;
        l.horizontal += b;
      } else if (f > y) {
        var _ = f - y;
        c -= _;
        l.horizontal += _;
      }
      return {
        top: u + "px",
        left: c + "px",
        transformOrigin: function (e) {
          return [e.horizontal, e.vertical].map(function (e) {
            if (typeof e == "number") {
              return e + "px";
            } else {
              return e;
            }
          }).join(" ");
        }(l)
      };
    };
    r.transitionEl = undefined;
    r.handleGetOffsetTop = x;
    r.handleGetOffsetLeft = E;
    r.handleEnter = function (e) {
      if (r.props.onEnter) {
        r.props.onEnter(e);
      }
      r.setPositioningStyles(e);
    };
    r.handleResize = (0, m.default)(function () {
      var e = d.default.findDOMNode(r.transitionEl);
      r.setPositioningStyles(e);
    }, 166);
    i = n;
    return (0, l.default)(r, i);
  }
  (0, u.default)(t, e);
  (0, s.default)(t, [{
    key: "componentDidMount",
    value: function () {
      if (this.props.action) {
        this.props.action({
          updatePosition: this.handleResize
        });
      }
    }
  }, {
    key: "getAnchorOffset",
    value: function (e) {
      var t = this.props;
      var n = t.anchorEl;
      var r = t.anchorOrigin;
      var i = t.anchorReference;
      var o = t.anchorPosition;
      if (i === "anchorPosition") {
        return o;
      }
      var a = (n || document.body).getBoundingClientRect();
      var s = e === 0 ? r.vertical : "center";
      return {
        top: a.top + this.handleGetOffsetTop(a, s),
        left: a.left + this.handleGetOffsetLeft(a, r.horizontal)
      };
    }
  }, {
    key: "getContentAnchorOffset",
    value: function (e) {
      var t = this.props;
      var n = t.getContentAnchorEl;
      var r = t.anchorReference;
      var i = 0;
      if (n && r === "anchorEl") {
        var o = n(e);
        if (o && (0, f.default)(e, o)) {
          var a = function (e, t) {
            for (var n = t, r = 0; n && n !== e;) {
              r += (n = n.parentNode).scrollTop;
            }
            return r;
          }(e, o);
          i = o.offsetTop + o.clientHeight / 2 - a || 0;
        }
      }
      return i;
    }
  }, {
    key: "getTransformOrigin",
    value: function (e, t = 0) {
      var n = this.props.transformOrigin;
      return {
        vertical: this.handleGetOffsetTop(e, n.vertical) + t,
        horizontal: this.handleGetOffsetLeft(e, n.horizontal)
      };
    }
  }, {
    key: "render",
    value: function () {
      var e = this;
      var t = this.props;
      var n = t.anchorEl;
      t.anchorOrigin;
      t.anchorPosition;
      t.anchorReference;
      var o = t.children;
      var a = t.classes;
      var s = t.container;
      var l = t.elevation;
      t.getContentAnchorEl;
      t.marginThreshold;
      t.onEnter;
      var u = t.onEntered;
      var d = t.onEntering;
      var f = t.onExit;
      var h = t.onExited;
      var m = t.onExiting;
      var g = t.open;
      var w = t.PaperProps;
      var x = t.role;
      t.transformOrigin;
      var E = t.transition;
      var S = t.transitionDuration;
      t.action;
      var T = (0, i.default)(t, ["anchorEl", "anchorOrigin", "anchorPosition", "anchorReference", "children", "classes", "container", "elevation", "getContentAnchorEl", "marginThreshold", "onEnter", "onEntered", "onEntering", "onExit", "onExited", "onExiting", "open", "PaperProps", "role", "transformOrigin", "transition", "transitionDuration", "action"]);
      var k = s || (n ? (0, p.default)(n).body : undefined);
      var O = {};
      if (E === b.default) {
        O.timeout = S;
      }
      return c.default.createElement(v.default, (0, r.default)({
        container: k,
        open: g,
        BackdropProps: {
          invisible: true
        }
      }, T), c.default.createElement(E, (0, r.default)({
        appear: true,
        in: g,
        onEnter: this.handleEnter,
        onEntered: u,
        onEntering: d,
        onExit: f,
        onExited: h,
        onExiting: m,
        role: x,
        ref: function (t) {
          e.transitionEl = t;
        }
      }, O), c.default.createElement(_.default, (0, r.default)({
        className: a.paper,
        elevation: l
      }, w), c.default.createElement(y.default, {
        target: "window",
        onResize: this.handleResize
      }), o)));
    }
  }]);
  return t;
}(c.default.Component);
T.propTypes = {};
T.defaultProps = {
  anchorReference: "anchorEl",
  anchorOrigin: {
    vertical: "top",
    horizontal: "left"
  },
  elevation: 8,
  marginThreshold: 16,
  transformOrigin: {
    vertical: "top",
    horizontal: "left"
  },
  transition: b.default,
  transitionDuration: "auto"
};
exports.default = (0, g.default)(S, {
  name: "MuiPopover"
})(T);