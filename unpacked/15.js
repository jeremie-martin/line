import * as r from "./0.js";
import * as i from "./1.js";
var o = i;
var a = o.shape({
  trySubscribe: o.func.isRequired,
  tryUnsubscribe: o.func.isRequired,
  notifyNestedSubs: o.func.isRequired,
  isSubscribed: o.func.isRequired
});
var s = o.shape({
  subscribe: o.func.isRequired,
  dispatch: o.func.isRequired,
  getState: o.func.isRequired
});
export function createProvider() {
  var e;
  var t = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "store";
  var n = arguments[1] || t + "Subscription";
  var i = function (e) {
    function i(n, r) {
      (function (e, t) {
        if (!(e instanceof t)) {
          throw new TypeError("Cannot call a class as a function");
        }
      })(this, i);
      var o = function (e, t) {
        if (!e) {
          throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        }
        if (!t || typeof t != "object" && typeof t != "function") {
          return e;
        } else {
          return t;
        }
      }(this, e.call(this, n, r));
      o[t] = n.store;
      return o;
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
    })(i, e);
    i.prototype.getChildContext = function () {
      var e;
      (e = {})[t] = this[t];
      e[n] = null;
      return e;
    };
    i.prototype.render = function () {
      return r.Children.only(this.props.children);
    };
    return i;
  }(r.Component);
  i.propTypes = {
    store: s.isRequired,
    children: o.element.isRequired
  };
  (e = {})[t] = s.isRequired;
  e[n] = a;
  i.childContextTypes = e;
  return i;
}
export var Provider = createProvider();
import * as c from "./416.js";
var d = c;
import * as f from "./182.js";
var p = f;
var h = null;
var m = {
  notify: function () {}
};
var y = function () {
  function e(t, n, r) {
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, e);
    this.store = t;
    this.parentSub = n;
    this.onStateChange = r;
    this.unsubscribe = null;
    this.listeners = m;
  }
  e.prototype.addNestedSub = function (e) {
    this.trySubscribe();
    return this.listeners.subscribe(e);
  };
  e.prototype.notifyNestedSubs = function () {
    this.listeners.notify();
  };
  e.prototype.isSubscribed = function () {
    return Boolean(this.unsubscribe);
  };
  e.prototype.trySubscribe = function () {
    var e;
    var t;
    if (!this.unsubscribe) {
      this.unsubscribe = this.parentSub ? this.parentSub.addNestedSub(this.onStateChange) : this.store.subscribe(this.onStateChange);
      this.listeners = (e = [], t = [], {
        clear: function () {
          t = h;
          e = h;
        },
        notify: function () {
          for (var n = e = t, r = 0; r < n.length; r++) {
            n[r]();
          }
        },
        get: function () {
          return t;
        },
        subscribe: function (n) {
          var r = true;
          if (t === e) {
            t = e.slice();
          }
          t.push(n);
          return function () {
            if (r && e !== h) {
              r = false;
              if (t === e) {
                t = e.slice();
              }
              t.splice(t.indexOf(n), 1);
            }
          };
        }
      });
    }
  };
  e.prototype.tryUnsubscribe = function () {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      this.listeners.clear();
      this.listeners = m;
    }
  };
  return e;
}();
var g = Object.assign || function (e) {
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
var v = 0;
var b = {};
function _() {}
export function connectAdvanced(e) {
  var t;
  var n;
  var i = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var o = i.getDisplayName;
  var l = o === undefined ? function (e) {
    return "ConnectAdvanced(" + e + ")";
  } : o;
  var u = i.methodName;
  var c = u === undefined ? "connectAdvanced" : u;
  var f = i.renderCountProp;
  var h = f === undefined ? undefined : f;
  var m = i.shouldHandleStateChanges;
  var w = m === undefined || m;
  var x = i.storeKey;
  var E = x === undefined ? "store" : x;
  var S = i.withRef;
  var T = S !== undefined && S;
  var k = function (e, t) {
    var n = {};
    for (var r in e) {
      if (!(t.indexOf(r) >= 0)) {
        if (Object.prototype.hasOwnProperty.call(e, r)) {
          n[r] = e[r];
        }
      }
    }
    return n;
  }(i, ["getDisplayName", "methodName", "renderCountProp", "shouldHandleStateChanges", "storeKey", "withRef"]);
  var O = E + "Subscription";
  var P = v++;
  (t = {})[E] = s;
  t[O] = a;
  var C = t;
  (n = {})[O] = a;
  var I = n;
  return function (t) {
    p(typeof t == "function", "You must pass a component to the function returned by " + c + ". Instead received " + JSON.stringify(t));
    var n = t.displayName || t.name || "Component";
    var i = l(n);
    var o = g({}, k, {
      getDisplayName: l,
      methodName: c,
      renderCountProp: h,
      shouldHandleStateChanges: w,
      storeKey: E,
      withRef: T,
      displayName: i,
      wrappedComponentName: n,
      WrappedComponent: t
    });
    var a = function (n) {
      function a(e, t) {
        (function (e, t) {
          if (!(e instanceof t)) {
            throw new TypeError("Cannot call a class as a function");
          }
        })(this, a);
        var r = function (e, t) {
          if (!e) {
            throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
          }
          if (!t || typeof t != "object" && typeof t != "function") {
            return e;
          } else {
            return t;
          }
        }(this, n.call(this, e, t));
        r.version = P;
        r.state = {};
        r.renderCount = 0;
        r.store = e[E] || t[E];
        r.propsMode = Boolean(e[E]);
        r.setWrappedInstance = r.setWrappedInstance.bind(r);
        p(r.store, "Could not find \"" + E + "\" in either the context or props of \"" + i + "\". Either wrap the root component in a <Provider>, or explicitly pass \"" + E + "\" as a prop to \"" + i + "\".");
        r.initSelector();
        r.initSubscription();
        return r;
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
      })(a, n);
      a.prototype.getChildContext = function () {
        var e;
        var t = this.propsMode ? null : this.subscription;
        (e = {})[O] = t || this.context[O];
        return e;
      };
      a.prototype.componentDidMount = function () {
        if (w) {
          this.subscription.trySubscribe();
          this.selector.run(this.props);
          if (this.selector.shouldComponentUpdate) {
            this.forceUpdate();
          }
        }
      };
      a.prototype.componentWillReceiveProps = function (e) {
        this.selector.run(e);
      };
      a.prototype.shouldComponentUpdate = function () {
        return this.selector.shouldComponentUpdate;
      };
      a.prototype.componentWillUnmount = function () {
        if (this.subscription) {
          this.subscription.tryUnsubscribe();
        }
        this.subscription = null;
        this.notifyNestedSubs = _;
        this.store = null;
        this.selector.run = _;
        this.selector.shouldComponentUpdate = false;
      };
      a.prototype.getWrappedInstance = function () {
        p(T, "To access the wrapped instance, you need to specify { withRef: true } in the options argument of the " + c + "() call.");
        return this.wrappedInstance;
      };
      a.prototype.setWrappedInstance = function (e) {
        this.wrappedInstance = e;
      };
      a.prototype.initSelector = function () {
        var t = e(this.store.dispatch, o);
        this.selector = function (e, t) {
          var n = {
            run: function (r) {
              try {
                var i = e(t.getState(), r);
                if (i !== n.props || n.error) {
                  n.shouldComponentUpdate = true;
                  n.props = i;
                  n.error = null;
                }
              } catch (e) {
                n.shouldComponentUpdate = true;
                n.error = e;
              }
            }
          };
          return n;
        }(t, this.store);
        this.selector.run(this.props);
      };
      a.prototype.initSubscription = function () {
        if (w) {
          var e = (this.propsMode ? this.props : this.context)[O];
          this.subscription = new y(this.store, e, this.onStateChange.bind(this));
          this.notifyNestedSubs = this.subscription.notifyNestedSubs.bind(this.subscription);
        }
      };
      a.prototype.onStateChange = function () {
        this.selector.run(this.props);
        if (this.selector.shouldComponentUpdate) {
          this.componentDidUpdate = this.notifyNestedSubsOnComponentDidUpdate;
          this.setState(b);
        } else {
          this.notifyNestedSubs();
        }
      };
      a.prototype.notifyNestedSubsOnComponentDidUpdate = function () {
        this.componentDidUpdate = undefined;
        this.notifyNestedSubs();
      };
      a.prototype.isSubscribed = function () {
        return Boolean(this.subscription) && this.subscription.isSubscribed();
      };
      a.prototype.addExtraProps = function (e) {
        if (!T && !h && (!this.propsMode || !this.subscription)) {
          return e;
        }
        var t = g({}, e);
        if (T) {
          t.ref = this.setWrappedInstance;
        }
        if (h) {
          t[h] = this.renderCount++;
        }
        if (this.propsMode && this.subscription) {
          t[O] = this.subscription;
        }
        return t;
      };
      a.prototype.render = function () {
        var e = this.selector;
        e.shouldComponentUpdate = false;
        if (e.error) {
          throw e.error;
        }
        return Object(r.createElement)(t, this.addExtraProps(e.props));
      };
      return a;
    }(r.Component);
    a.WrappedComponent = t;
    a.displayName = i;
    a.childContextTypes = I;
    a.contextTypes = C;
    a.propTypes = C;
    return d(a, t);
  };
}
var x = Object.prototype.hasOwnProperty;
function E(e, t) {
  if (e === t) {
    return e !== 0 || t !== 0 || 1 / e == 1 / t;
  } else {
    return e != e && t != t;
  }
}
function S(e, t) {
  if (E(e, t)) {
    return true;
  }
  if (typeof e != "object" || e === null || typeof t != "object" || t === null) {
    return false;
  }
  var n = Object.keys(e);
  var r = Object.keys(t);
  if (n.length !== r.length) {
    return false;
  }
  for (var i = 0; i < n.length; i++) {
    if (!x.call(t, n[i]) || !E(e[n[i]], t[n[i]])) {
      return false;
    }
  }
  return true;
}
import * as T from "./181.js";
import * as k from "./417.js";
var O = typeof self == "object" && self && self.Object === Object && self;
var P = (k.a || O || Function("return this")()).Symbol;
var C = Object.prototype;
C.hasOwnProperty;
C.toString;
if (P) {
  P.toStringTag;
}
Object.prototype.toString;
if (P) {
  P.toStringTag;
}
Object.getPrototypeOf;
Object;
var I = Function.prototype;
var M = Object.prototype;
var L = I.toString;
M.hasOwnProperty;
L.call(Object);
function R(e) {
  return function (t, n) {
    var r = e(t, n);
    function i() {
      return r;
    }
    i.dependsOnOwnProps = false;
    return i;
  };
}
function A(e) {
  if (e.dependsOnOwnProps !== null && e.dependsOnOwnProps !== undefined) {
    return Boolean(e.dependsOnOwnProps);
  } else {
    return e.length !== 1;
  }
}
function D(e, t) {
  return function (t, n) {
    n.displayName;
    function r(e, t) {
      if (r.dependsOnOwnProps) {
        return r.mapToProps(e, t);
      } else {
        return r.mapToProps(e);
      }
    }
    r.dependsOnOwnProps = true;
    r.mapToProps = function (t, n) {
      r.mapToProps = e;
      r.dependsOnOwnProps = A(e);
      var i = r(t, n);
      if (typeof i == "function") {
        r.mapToProps = i;
        r.dependsOnOwnProps = A(i);
        i = r(t, n);
      }
      return i;
    };
    return r;
  };
}
var N = [function (e) {
  if (typeof e == "function") {
    return D(e);
  } else {
    return undefined;
  }
}, function (e) {
  if (e) {
    return undefined;
  } else {
    return R(function (e) {
      return {
        dispatch: e
      };
    });
  }
}, function (e) {
  if (e && typeof e == "object") {
    return R(function (t) {
      return Object(T.bindActionCreators)(e, t);
    });
  } else {
    return undefined;
  }
}];
var j = [function (e) {
  if (typeof e == "function") {
    return D(e);
  } else {
    return undefined;
  }
}, function (e) {
  if (e) {
    return undefined;
  } else {
    return R(function () {
      return {};
    });
  }
}];
var F = Object.assign || function (e) {
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
function B(e, t, n) {
  return F({}, n, e, t);
}
var U = [function (e) {
  if (typeof e == "function") {
    return function (e) {
      return function (t, n) {
        n.displayName;
        var r = n.pure;
        var i = n.areMergedPropsEqual;
        var o = false;
        var a = undefined;
        return function (t, n, s) {
          var l = e(t, n, s);
          if (o) {
            if (!r || !i(l, a)) {
              a = l;
            }
          } else {
            o = true;
            a = l;
          }
          return a;
        };
      };
    }(e);
  } else {
    return undefined;
  }
}, function (e) {
  if (e) {
    return undefined;
  } else {
    return function () {
      return B;
    };
  }
}];
function z(e, t, n, r) {
  return function (i, o) {
    return n(e(i, o), t(r, o), o);
  };
}
function H(e, t, n, r, i) {
  var o = i.areStatesEqual;
  var a = i.areOwnPropsEqual;
  var s = i.areStatePropsEqual;
  var l = false;
  var u = undefined;
  var c = undefined;
  var d = undefined;
  var f = undefined;
  var p = undefined;
  function h(i, l) {
    var h;
    var m;
    var y = !a(l, c);
    var g = !o(i, u);
    u = i;
    c = l;
    if (y && g) {
      d = e(u, c);
      if (t.dependsOnOwnProps) {
        f = t(r, c);
      }
      return p = n(d, f, c);
    } else if (y) {
      if (e.dependsOnOwnProps) {
        d = e(u, c);
      }
      if (t.dependsOnOwnProps) {
        f = t(r, c);
      }
      return p = n(d, f, c);
    } else if (g) {
      h = e(u, c);
      m = !s(h, d);
      d = h;
      if (m) {
        p = n(d, f, c);
      }
      return p;
    } else {
      return p;
    }
  }
  return function (i, o) {
    if (l) {
      return h(i, o);
    } else {
      d = e(u = i, c = o);
      f = t(r, c);
      p = n(d, f, c);
      l = true;
      return p;
    }
  };
}
function V(e, t) {
  var n = t.initMapStateToProps;
  var r = t.initMapDispatchToProps;
  var i = t.initMergeProps;
  var o = function (e, t) {
    var n = {};
    for (var r in e) {
      if (!(t.indexOf(r) >= 0)) {
        if (Object.prototype.hasOwnProperty.call(e, r)) {
          n[r] = e[r];
        }
      }
    }
    return n;
  }(t, ["initMapStateToProps", "initMapDispatchToProps", "initMergeProps"]);
  var a = n(e, o);
  var s = r(e, o);
  var l = i(e, o);
  return (o.pure ? H : z)(a, s, l, e, o);
}
var W = Object.assign || function (e) {
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
function q(e, t, n) {
  for (var r = t.length - 1; r >= 0; r--) {
    var i = t[r](e);
    if (i) {
      return i;
    }
  }
  return function (t, r) {
    throw new Error("Invalid value of type " + typeof e + " for " + n + " argument when connecting component " + r.wrappedComponentName + ".");
  };
}
function G(e, t) {
  return e === t;
}
export var connect = function (e = {}) {
  var t = e.connectHOC;
  var n = t === undefined ? connectAdvanced : t;
  var r = e.mapStateToPropsFactories;
  var i = r === undefined ? j : r;
  var o = e.mapDispatchToPropsFactories;
  var a = o === undefined ? N : o;
  var s = e.mergePropsFactories;
  var l = s === undefined ? U : s;
  var u = e.selectorFactory;
  var c = u === undefined ? V : u;
  return function (e, t, r, o = {}) {
    var s = o.pure;
    var u = s === undefined || s;
    var d = o.areStatesEqual;
    var f = d === undefined ? G : d;
    var p = o.areOwnPropsEqual;
    var h = p === undefined ? S : p;
    var m = o.areStatePropsEqual;
    var y = m === undefined ? S : m;
    var g = o.areMergedPropsEqual;
    var v = g === undefined ? S : g;
    var b = function (e, t) {
      var n = {};
      for (var r in e) {
        if (!(t.indexOf(r) >= 0)) {
          if (Object.prototype.hasOwnProperty.call(e, r)) {
            n[r] = e[r];
          }
        }
      }
      return n;
    }(o, ["pure", "areStatesEqual", "areOwnPropsEqual", "areStatePropsEqual", "areMergedPropsEqual"]);
    var _ = q(e, i, "mapStateToProps");
    var w = q(t, a, "mapDispatchToProps");
    var x = q(r, l, "mergeProps");
    return n(c, W({
      methodName: "connect",
      getDisplayName: function (e) {
        return "Connect(" + e + ")";
      },
      shouldHandleStateChanges: Boolean(e),
      initMapStateToProps: _,
      initMapDispatchToProps: w,
      initMergeProps: x,
      pure: u,
      areStatesEqual: f,
      areOwnPropsEqual: h,
      areStatePropsEqual: y,
      areMergedPropsEqual: v
    }, b));
  };
}();