Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = function () {
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
var i = require("./0.js");
a(i);
var o = a(require("./1.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function s(e, t) {
  if (!e) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }
  if (!t || typeof t != "object" && typeof t != "function") {
    return e;
  } else {
    return t;
  }
}
var l = function (e) {
  function t() {
    var e;
    var n;
    var r;
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, t);
    for (var i = arguments.length, o = Array(i), a = 0; a < i; a++) {
      o[a] = arguments[a];
    }
    n = r = s(this, (e = t.__proto__ || Object.getPrototypeOf(t)).call.apply(e, [this].concat(o)));
    r._setTargetNode = function (e) {
      r._targetNode = e;
    };
    r._getTargetNode = function () {
      return r._targetNode;
    };
    return s(r, n);
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
  })(t, i.Component);
  r(t, [{
    key: "getChildContext",
    value: function () {
      return {
        popperManager: {
          setTargetNode: this._setTargetNode,
          getTargetNode: this._getTargetNode
        }
      };
    }
  }, {
    key: "render",
    value: function () {
      var e = this.props;
      var t = e.tag;
      var n = e.children;
      var r = function (e, t) {
        var n = {};
        for (var r in e) {
          if (!(t.indexOf(r) >= 0)) {
            if (Object.prototype.hasOwnProperty.call(e, r)) {
              n[r] = e[r];
            }
          }
        }
        return n;
      }(e, ["tag", "children"]);
      if (t !== false) {
        return (0, i.createElement)(t, r, n);
      } else {
        return n;
      }
    }
  }]);
  return t;
}();
l.childContextTypes = {
  popperManager: o.default.object.isRequired
};
l.propTypes = {
  tag: o.default.oneOfType([o.default.string, o.default.bool])
};
l.defaultProps = {
  tag: "div"
};
exports.default = l;