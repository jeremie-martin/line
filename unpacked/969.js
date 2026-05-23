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
var i = Object.assign || function (e) {
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
var o = require("./0.js");
var a = m(o);
var s = m(require("./1.js"));
var l = m(require("./1067.js"));
var u = require("./971.js");
var c = m(u);
var d = m(require("./999.js"));
var f = m(require("./1000.js"));
var p = function (e) {
  if (e && e.__esModule) {
    return e;
  }
  var t = {};
  if (e != null) {
    for (var n in e) {
      if (Object.prototype.hasOwnProperty.call(e, n)) {
        t[n] = e[n];
      }
    }
  }
  t.default = e;
  return t;
}(require("./231.js"));
var h = m(require("./338.js"));
function m(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function y(e, t) {
  var n = {};
  for (var r in e) {
    if (!(t.indexOf(r) >= 0)) {
      if (Object.prototype.hasOwnProperty.call(e, r)) {
        n[r] = e[r];
      }
    }
  }
  return n;
}
var g = Math.random();
var v = {
  sheet: false,
  classes: true,
  theme: true
};
var b = 0;
exports.default = function (e, t) {
  var n;
  var m;
  var _;
  var w = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var x = typeof e == "function";
  var E = w.theming;
  var S = E === undefined ? l.default : E;
  var T = w.inject;
  var k = w.jss;
  var O = y(w, ["theming", "inject", "jss"]);
  var P = T ? T.reduce(function (e, t) {
    e[t] = true;
    return e;
  }, {}) : v;
  var C = S.themeListener;
  var I = (0, f.default)(t);
  var M = {};
  var L = b++;
  var R = new u.SheetsManager();
  var A = i({}, t.defaultProps);
  delete A.classes;
  m = n = function (n) {
    function s(e, t) {
      (function (e, t) {
        if (!(e instanceof t)) {
          throw new TypeError("Cannot call a class as a function");
        }
      })(this, s);
      var n = function (e, t) {
        if (!e) {
          throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        }
        if (!t || typeof t != "object" && typeof t != "function") {
          return e;
        } else {
          return t;
        }
      }(this, (s.__proto__ || Object.getPrototypeOf(s)).call(this, e, t));
      _.call(n);
      var r = x ? C.initial(t) : M;
      n.state = n.createState({
        theme: r
      }, e);
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
    })(s, o.Component);
    r(s, [{
      key: "createState",
      value: function (n, r) {
        var o = n.theme;
        var a = n.dynamicSheet;
        var s = r.classes;
        var l = this.context[p.sheetOptions];
        var c = undefined;
        var f = this.manager.get(o);
        var h = undefined;
        if (l && l.classNamePrefix) {
          c = l.classNamePrefix + c;
        }
        if (f) {
          h = f[g];
        } else {
          var m = function (e, t) {
            if (typeof e != "function") {
              return e;
            } else {
              return e(t);
            }
          }(e, o);
          f = this.jss.createStyleSheet(m, i({}, O, l, {
            meta: I + ", " + (x ? "Themed" : "Unthemed") + ", Static",
            classNamePrefix: c
          }));
          this.manager.add(o, f);
          h = (0, d.default)(f.classes, (0, u.getDynamicStyles)(m));
          f[g] = h;
        }
        if (h) {
          a = this.jss.createStyleSheet(h, i({}, O, l, {
            meta: I + ", " + (x ? "Themed" : "Unthemed") + ", Dynamic",
            classNamePrefix: c,
            link: true
          }));
        }
        var y = a || f;
        var v = t.defaultProps ? t.defaultProps.classes : {};
        return {
          theme: o,
          dynamicSheet: a,
          classes: i({}, v, y.classes, s)
        };
      }
    }, {
      key: "manage",
      value: function (e) {
        var t = e.theme;
        var n = e.dynamicSheet;
        var r = this.context[p.sheetsRegistry];
        var i = this.manager.manage(t);
        if (r) {
          r.add(i);
        }
        if (n) {
          n.update(this.props).attach();
          if (r) {
            r.add(n);
          }
        }
      }
    }, {
      key: "componentWillMount",
      value: function () {
        this.manage(this.state);
      }
    }, {
      key: "componentDidMount",
      value: function () {
        if (x) {
          this.unsubscribeId = C.subscribe(this.context, this.setTheme);
        }
      }
    }, {
      key: "componentWillReceiveProps",
      value: function (e, t) {
        this.context = t;
        var n = this.state.dynamicSheet;
        if (n) {
          n.update(e);
        }
      }
    }, {
      key: "componentWillUpdate",
      value: function (e, t) {
        if (x && this.state.theme !== t.theme) {
          var n = this.createState(t, e);
          this.manage(n);
          this.manager.unmanage(this.state.theme);
          this.setState(n);
        }
      }
    }, {
      key: "componentDidUpdate",
      value: function (e, t) {
        if (t.dynamicSheet !== this.state.dynamicSheet) {
          this.jss.removeStyleSheet(t.dynamicSheet);
        }
      }
    }, {
      key: "componentWillUnmount",
      value: function () {
        if (this.unsubscribeId) {
          C.unsubscribe(this.context, this.unsubscribeId);
        }
        this.manager.unmanage(this.state.theme);
        if (this.state.dynamicSheet) {
          this.state.dynamicSheet.detach();
        }
      }
    }, {
      key: "render",
      value: function () {
        var e = this.state;
        var n = e.theme;
        var r = e.dynamicSheet;
        var o = e.classes;
        var s = this.props;
        var l = s.innerRef;
        var u = y(s, ["innerRef"]);
        var c = r || this.manager.get(n);
        if (P.sheet && !u.sheet) {
          u.sheet = c;
        }
        if (x && P.theme && !u.theme) {
          u.theme = n;
        }
        if (P.classes) {
          u.classes = o;
        }
        return a.default.createElement(t, i({
          ref: l
        }, u));
      }
    }, {
      key: "jss",
      get: function () {
        return this.context[p.jss] || k || c.default;
      }
    }, {
      key: "manager",
      get: function () {
        var e = this.context[p.managers];
        if (e) {
          e[L] ||= new u.SheetsManager();
          return e[L];
        } else {
          return R;
        }
      }
    }]);
    return s;
  }();
  n.displayName = "Jss(" + I + ")";
  n.InnerComponent = t;
  n.contextTypes = i({}, h.default, x && C.contextTypes);
  n.propTypes = {
    innerRef: s.default.func
  };
  n.defaultProps = A;
  _ = function () {
    var e = this;
    this.setTheme = function (t) {
      return e.setState({
        theme: t
      });
    };
  };
  return m;
};