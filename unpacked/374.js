Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.__test__ = undefined;
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
var o = s(require("./0.js"));
var a = s(require("./1.js"));
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var l = {
  onPointerMove: "pointermove",
  onPointerDown: "pointerdown",
  onPointerUp: "pointerup",
  onPointerOver: "pointerover",
  onPointerOut: "pointerout",
  onPointerEnter: "pointerenter",
  onPointerLeave: "pointerleave",
  onPointerCancel: "pointercancel"
};
var u = Object.keys(l);
var c = function (e) {
  function t(e) {
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, t);
    var n = function (e, t) {
      if (!e) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
      }
      if (!t || typeof t != "object" && typeof t != "function") {
        return e;
      } else {
        return t;
      }
    }(this, (t.__proto__ || Object.getPrototypeOf(t)).call(this, e));
    n.setRef = n.setRef.bind(n);
    return n;
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
  })(t, o.default.Component);
  i(t, [{
    key: "componentDidMount",
    value: function () {
      d(this.pointableNode, this.props);
    }
  }, {
    key: "componentDidUpdate",
    value: function (e) {
      f(this.pointableNode, e, this.props);
    }
  }, {
    key: "setRef",
    value: function (e) {
      this.pointableNode = e;
      if (this.props.elementRef) {
        this.props.elementRef(e);
      }
    }
  }, {
    key: "render",
    value: function () {
      var e = r({}, this.props);
      u.forEach(function (t) {
        return delete e[t];
      });
      delete e.children;
      delete e.tagName;
      delete e.touchAction;
      delete e.elementRef;
      var t = this.props.tagName;
      return o.default.createElement(t, r({
        ref: this.setRef
      }, e), this.props.children);
    }
  }]);
  return t;
}();
c.propTypes = {
  tagName: a.default.string.isRequired,
  touchAction: a.default.oneOf(["auto", "none", "pan-x", "pan-y", "manipulation"]).isRequired,
  elementRef: a.default.func,
  onPointerMove: a.default.func,
  onPointerDown: a.default.func,
  onPointerUp: a.default.func,
  onPointerOver: a.default.func,
  onPointerOut: a.default.func,
  onPointerEnter: a.default.func,
  onPointerLeave: a.default.func,
  onPointerCancel: a.default.func
};
c.defaultProps = {
  tagName: "div",
  touchAction: "auto"
};
exports.default = c;
function d(e, t) {
  var n = false;
  u.forEach(function (r) {
    var i = t[r];
    if (i) {
      n = true;
      e.addEventListener(l[r], i);
    }
  });
  if (n) {
    e.setAttribute("touch-action", t.touchAction);
  }
}
function f(e, t, n) {
  var r = false;
  u.forEach(function (i) {
    var o = t[i];
    var a = n[i];
    if (a) {
      r = true;
    }
    if (o !== a && (o || a)) {
      if (o) {
        e.removeEventListener(l[i], o);
      }
      if (a) {
        e.addEventListener(l[i], a);
      }
    }
  });
  if (r) {
    e.setAttribute("touch-action", n.touchAction);
  } else {
    e.removeAttribute("touch-action");
  }
}
exports.__test__ = {
  initNodeWithPE: d,
  updateNodeWithPE: f
};