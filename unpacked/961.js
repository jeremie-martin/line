Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = Object.assign || function (e) {
  for (var t = 1; t < arguments.length; t++) {
    var n = arguments[t];
    for (var r in n) {
      if (Object.prototype.hasOwnProperty.call(n, r)) {
        e[r] = n[r];
      }
    }
  }
  return e;
};
var i = function () {
  function e(e, t) {
    for (var n = 0; n < t.length; n++) {
      var r = t[n];
      r.enumerable = r.enumerable || false;
      r.configurable = true;
      if ("value" in r) {
        r.writable = true;
      }
      Object.defineProperty(e, r.key, r);
    }
  }
  return function (t, n, r) {
    if (n) {
      e(t.prototype, n);
    }
    if (r) {
      e(t, r);
    }
    return t;
  };
}();
var o = require("./0.js");
l(o);
var a = l(require("./1.js"));
var s = l(require("./962.js"));
function l(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function u(e, t, n) {
  if (t in e) {
    Object.defineProperty(e, t, {
      value: n,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    e[t] = n;
  }
  return e;
}
function c(e, t) {
  if (!e) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }
  if (!t || typeof t != "object" && typeof t != "function") {
    return e;
  } else {
    return t;
  }
}
var d = function (e) {
  function t() {
    var e;
    var n;
    var i;
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, t);
    for (var o = arguments.length, a = Array(o), s = 0; s < o; s++) {
      a[s] = arguments[s];
    }
    n = i = c(this, (e = t.__proto__ || Object.getPrototypeOf(t)).call.apply(e, [this].concat(a)));
    i.state = {};
    i._setArrowNode = function (e) {
      i._arrowNode = e;
    };
    i._getTargetNode = function () {
      return i.context.popperManager.getTargetNode();
    };
    i._getOffsets = function (e) {
      return Object.keys(e.offsets).map(function (t) {
        return e.offsets[t];
      });
    };
    i._isDataDirty = function (e) {
      return !i.state.data || JSON.stringify(i._getOffsets(i.state.data)) !== JSON.stringify(i._getOffsets(e));
    };
    i._updateStateModifier = {
      enabled: true,
      order: 900,
      fn: function (e) {
        if (i._isDataDirty(e)) {
          i.setState({
            data: e
          });
        }
        return e;
      }
    };
    i._getPopperStyle = function () {
      var e = i.state.data;
      if (!e) {
        return {
          position: "absolute",
          pointerEvents: "none",
          opacity: 0
        };
      }
      var t = e.offsets.popper;
      t.top;
      t.left;
      var n = t.position;
      return r({
        position: n
      }, e.styles);
    };
    i._getPopperPlacement = function () {
      if (i.state.data) {
        return i.state.data.placement;
      } else {
        return undefined;
      }
    };
    i._getPopperHide = function () {
      if (i.state.data && i.state.data.hide) {
        return "";
      } else {
        return undefined;
      }
    };
    i._getArrowStyle = function () {
      if (i.state.data && i.state.data.offsets.arrow) {
        var e = i.state.data.offsets.arrow;
        return {
          top: e.top,
          left: e.left
        };
      }
      return {};
    };
    return c(i, n);
  }
  (function (e, t) {
    if (typeof t != "function" && t !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof t);
    }
    e.prototype = Object.create(t && t.prototype, {
      constructor: {
        value: e,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (t) {
      if (Object.setPrototypeOf) {
        Object.setPrototypeOf(e, t);
      } else {
        e.__proto__ = t;
      }
    }
  })(t, o.Component);
  i(t, [{
    key: "getChildContext",
    value: function () {
      return {
        popper: {
          setArrowNode: this._setArrowNode,
          getArrowStyle: this._getArrowStyle
        }
      };
    }
  }, {
    key: "componentDidUpdate",
    value: function (e) {
      if (e.placement !== this.props.placement || e.eventsEnabled !== this.props.eventsEnabled) {
        this._destroyPopper();
        this._createPopper();
      }
      if (e.children !== this.props.children) {
        this._popper.scheduleUpdate();
      }
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      this._destroyPopper();
    }
  }, {
    key: "_createPopper",
    value: function () {
      var e = this.props;
      var t = e.placement;
      var n = e.eventsEnabled;
      var i = r({}, this.props.modifiers, {
        applyStyle: {
          enabled: false
        },
        updateState: this._updateStateModifier
      });
      if (this._arrowNode) {
        i.arrow = {
          element: this._arrowNode
        };
      }
      this._popper = new s.default(this._getTargetNode(), this._node, {
        placement: t,
        eventsEnabled: n,
        modifiers: i
      });
      this._popper.scheduleUpdate();
    }
  }, {
    key: "_destroyPopper",
    value: function () {
      if (this._popper) {
        this._popper.destroy();
      }
    }
  }, {
    key: "render",
    value: function () {
      var e;
      var t = this;
      var n = this.props;
      var i = n.component;
      var a = n.innerRef;
      n.placement;
      n.eventsEnabled;
      n.modifiers;
      var s = n.children;
      var l = function (e, t) {
        var n = {};
        for (var r in e) {
          if (!(t.indexOf(r) >= 0)) {
            if (Object.prototype.hasOwnProperty.call(e, r)) {
              n[r] = e[r];
            }
          }
        }
        return n;
      }(n, ["component", "innerRef", "placement", "eventsEnabled", "modifiers", "children"]);
      function c(e) {
        t._node = e;
        if (e) {
          t._createPopper();
        } else {
          t._destroyPopper();
        }
        if (typeof a == "function") {
          a(e);
        }
      }
      var d = this._getPopperStyle();
      var f = this._getPopperPlacement();
      var p = this._getPopperHide();
      if (typeof s == "function") {
        return s({
          popperProps: (u(e = {
            ref: c,
            style: d
          }, "data-placement", f), u(e, "data-x-out-of-boundaries", p), e),
          restProps: l,
          scheduleUpdate: function () {
            if (t._popper) {
              t._popper.scheduleUpdate();
            }
          }
        });
      }
      var h = r({}, l, {
        style: r({}, l.style, d),
        "data-placement": f,
        "data-x-out-of-boundaries": p
      });
      if (typeof i == "string") {
        h.ref = c;
      } else {
        h.innerRef = c;
      }
      return (0, o.createElement)(i, h, s);
    }
  }]);
  return t;
}();
d.contextTypes = {
  popperManager: a.default.object.isRequired
};
d.childContextTypes = {
  popper: a.default.object.isRequired
};
d.propTypes = {
  component: a.default.oneOfType([a.default.node, a.default.func]),
  innerRef: a.default.func,
  placement: a.default.oneOf(s.default.placements),
  eventsEnabled: a.default.bool,
  modifiers: a.default.object,
  children: a.default.oneOfType([a.default.node, a.default.func])
};
d.defaultProps = {
  component: "div",
  placement: "bottom",
  eventsEnabled: true,
  modifiers: {}
};
exports.default = d;