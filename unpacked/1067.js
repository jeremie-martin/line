import * as r from "./0.js";
var i = r;
import * as o from "./1.js";
var a = o;
import * as s from "./418.js";
var l = s;
import * as u from "./262.js";
var c = u;
var d = "__THEMING__";
import * as f from "./261.js";
var p = Object.assign || function (e) {
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
var h = function () {
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
function m(e, t, n) {
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
function y(e, t) {
  if (!e) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }
  if (!t || typeof t != "object" && typeof t != "function") {
    return e;
  } else {
    return t;
  }
}
function g() {
  var e;
  var t;
  var n = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : d;
  t = e = function (e) {
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
      n = r = y(this, (e = t.__proto__ || Object.getPrototypeOf(t)).call.apply(e, [this].concat(o)));
      r.broadcast = Object(f.default)(r.getTheme());
      r.setOuterTheme = function (e) {
        r.outerTheme = e;
      };
      return y(r, n);
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
    h(t, [{
      key: "getTheme",
      value: function (e) {
        var t = e || this.props.theme;
        if (l(t)) {
          var n = t(this.outerTheme);
          if (!c(n)) {
            throw new Error("[ThemeProvider] Please return an object from your theme function, i.e. theme={() => ({})}!");
          }
          return n;
        }
        if (!c(t)) {
          throw new Error("[ThemeProvider] Please make your theme prop a plain object");
        }
        if (this.outerTheme) {
          return p({}, this.outerTheme, t);
        } else {
          return t;
        }
      }
    }, {
      key: "getChildContext",
      value: function () {
        return m({}, n, this.broadcast);
      }
    }, {
      key: "componentDidMount",
      value: function () {
        if (this.context[n]) {
          this.subscriptionId = this.context[n].subscribe(this.setOuterTheme);
        }
      }
    }, {
      key: "componentWillMount",
      value: function () {
        if (this.context[n]) {
          this.setOuterTheme(this.context[n].getState());
          this.broadcast.setState(this.getTheme());
        }
      }
    }, {
      key: "componentWillReceiveProps",
      value: function (e) {
        if (this.props.theme !== e.theme) {
          this.broadcast.setState(this.getTheme(e.theme));
        }
      }
    }, {
      key: "componentWillUnmount",
      value: function () {
        if (this.subscriptionId !== undefined) {
          this.context[n].unsubscribe(this.subscriptionId);
          delete this.subscriptionId;
        }
      }
    }, {
      key: "render",
      value: function () {
        if (this.props.children) {
          return i.Children.only(this.props.children);
        } else {
          return null;
        }
      }
    }]);
    return t;
  }();
  e.propTypes = {
    children: a.element,
    theme: a.oneOfType([a.shape({}), a.func]).isRequired
  };
  e.childContextTypes = m({}, n, a.object.isRequired);
  e.contextTypes = m({}, n, a.object);
  return t;
}
function v() {
  var e;
  var t;
  var n;
  var r = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : d;
  return {
    contextTypes: (e = {}, t = r, n = a.object.isRequired, t in e ? Object.defineProperty(e, t, {
      value: n,
      enumerable: true,
      configurable: true,
      writable: true
    }) : e[t] = n, e),
    initial: function (e) {
      if (!e[r]) {
        throw new Error("[" + this.displayName + "] Please use ThemeProvider to be able to use WithTheme");
      }
      return e[r].getState();
    },
    subscribe: function (e, t) {
      if (e[r]) {
        return e[r].subscribe(t);
      }
    },
    unsubscribe: function (e, t) {
      if (e[r]) {
        e[r].unsubscribe(t);
      }
    }
  };
}
var b = Object.assign || function (e) {
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
var _ = function () {
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
function w(e) {
  return e.displayName || e.name || "Component";
}
function x() {
  var e = v(arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : d);
  return function (t) {
    var n;
    var r;
    r = n = function (n) {
      function r(t, n) {
        (function (e, t) {
          if (!(e instanceof t)) {
            throw new TypeError("Cannot call a class as a function");
          }
        })(this, r);
        var i = function (e, t) {
          if (!e) {
            throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
          }
          if (!t || typeof t != "object" && typeof t != "function") {
            return e;
          } else {
            return t;
          }
        }(this, (r.__proto__ || Object.getPrototypeOf(r)).call(this, t, n));
        i.state = {
          theme: e.initial(n)
        };
        i.setTheme = function (e) {
          return i.setState({
            theme: e
          });
        };
        return i;
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
      })(r, i.Component);
      _(r, [{
        key: "componentDidMount",
        value: function () {
          this.unsubscribe = e.subscribe(this.context, this.setTheme);
        }
      }, {
        key: "componentWillUnmount",
        value: function () {
          if (typeof this.unsubscribe == "function") {
            this.unsubscribe();
          }
        }
      }, {
        key: "render",
        value: function () {
          var e = this.state.theme;
          return i.createElement(t, b({
            theme: e
          }, this.props));
        }
      }]);
      return r;
    }();
    n.displayName = "WithTheme(" + w(t) + ")";
    n.contextTypes = e.contextTypes;
    return r;
  };
}
export var channel = d;
export var withTheme = x();
export var ThemeProvider = g();
export var themeListener = v();
export function createTheming(e = d) {
  return {
    channel: e,
    withTheme: x(e),
    ThemeProvider: g(e),
    themeListener: v(e)
  };
}
exports.default = {
  channel: d,
  withTheme: withTheme,
  ThemeProvider: ThemeProvider,
  themeListener: themeListener,
  createTheming: createTheming
};