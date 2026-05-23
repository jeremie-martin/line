Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = d(require("./10.js"));
var i = d(require("./9.js"));
var o = d(require("./11.js"));
var a = d(require("./12.js"));
var s = d(require("./13.js"));
var l = d(require("./0.js"));
var u = d(require("./21.js"));
d(require("./1.js"));
var c = d(require("./62.js"));
d(require("./163.js"));
function d(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function f(e, t) {
  e = typeof e == "function" ? e() : e;
  return u.default.findDOMNode(e) || t;
}
function p(e) {
  return (0, c.default)(u.default.findDOMNode(e));
}
var h = function (e) {
  function t() {
    var e;
    var n;
    var o;
    var s;
    (0, i.default)(this, t);
    for (var l = arguments.length, c = Array(l), d = 0; d < l; d++) {
      c[d] = arguments[d];
    }
    n = o = (0, a.default)(this, (e = t.__proto__ || (0, r.default)(t)).call.apply(e, [this].concat(c)));
    o.getMountNode = function () {
      return o.mountNode;
    };
    o.mountOverlayTarget = function () {
      if (!o.overlayTarget) {
        o.overlayTarget = document.createElement("div");
        o.mountNode = f(o.props.container, p(o).body);
        o.mountNode.appendChild(o.overlayTarget);
      }
    };
    o.unmountOverlayTarget = function () {
      if (o.overlayTarget) {
        o.mountNode.removeChild(o.overlayTarget);
        o.overlayTarget = null;
      }
      o.mountNode = null;
    };
    o.unrenderOverlay = function () {
      if (o.overlayTarget) {
        u.default.unmountComponentAtNode(o.overlayTarget);
        o.overlayInstance = null;
      }
    };
    o.renderOverlay = function () {
      var e = o.props.children;
      o.mountOverlayTarget();
      var t = !o.overlayInstance;
      o.overlayInstance = u.default.unstable_renderSubtreeIntoContainer(o, e, o.overlayTarget, function () {
        if (t && o.props.onRendered) {
          o.props.onRendered();
        }
      });
    };
    s = n;
    return (0, a.default)(o, s);
  }
  (0, s.default)(t, e);
  (0, o.default)(t, [{
    key: "componentDidMount",
    value: function () {
      this.mounted = true;
      this.renderOverlay();
    }
  }, {
    key: "componentWillReceiveProps",
    value: function (e) {
      if (this.overlayTarget && e.container !== this.props.container) {
        this.mountNode.removeChild(this.overlayTarget);
        this.mountNode = f(e.container, p(this).body);
        this.mountNode.appendChild(this.overlayTarget);
      }
    }
  }, {
    key: "componentDidUpdate",
    value: function () {
      this.renderOverlay();
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      this.mounted = false;
      this.unrenderOverlay();
      this.unmountOverlayTarget();
    }
  }, {
    key: "render",
    value: function () {
      return null;
    }
  }]);
  return t;
}(l.default.Component);
h.propTypes = {};
h.propTypes = {};
exports.default = h;