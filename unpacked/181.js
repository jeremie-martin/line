import * as r from "./415.js";
var i = typeof self == "object" && self && self.Object === Object && self;
var o = (r.a || i || Function("return this")()).Symbol;
var a = Object.prototype;
var s = a.hasOwnProperty;
var l = a.toString;
var u = o ? o.toStringTag : undefined;
function c(e) {
  var t = s.call(e, u);
  var n = e[u];
  try {
    e[u] = undefined;
    var r = true;
  } catch (e) {}
  var i = l.call(e);
  if (r) {
    if (t) {
      e[u] = n;
    } else {
      delete e[u];
    }
  }
  return i;
}
var d = Object.prototype.toString;
function f(e) {
  return d.call(e);
}
var p = "[object Null]";
var h = "[object Undefined]";
var m = o ? o.toStringTag : undefined;
function y(e) {
  if (e == null) {
    if (e === undefined) {
      return h;
    } else {
      return p;
    }
  } else if (m && m in Object(e)) {
    return c(e);
  } else {
    return f(e);
  }
}
var g = function (e, t) {
  return function (n) {
    return e(t(n));
  };
}(Object.getPrototypeOf, Object);
function v(e) {
  return e != null && typeof e == "object";
}
var b = "[object Object]";
var _ = Function.prototype;
var w = Object.prototype;
var x = _.toString;
var E = w.hasOwnProperty;
var S = x.call(Object);
function T(e) {
  if (!v(e) || y(e) != b) {
    return false;
  }
  var t = g(e);
  if (t === null) {
    return true;
  }
  var n = E.call(t, "constructor") && t.constructor;
  return typeof n == "function" && n instanceof n && x.call(n) == S;
}
import * as k from "./133.js";
var O = k;
export function createStore(e, t, n) {
  var r;
  if (typeof t == "function" && n === undefined) {
    n = t;
    t = undefined;
  }
  if (n !== undefined) {
    if (typeof n != "function") {
      throw new Error("Expected the enhancer to be a function.");
    }
    return n(createStore)(e, t);
  }
  if (typeof e != "function") {
    throw new Error("Expected the reducer to be a function.");
  }
  var i = e;
  var o = t;
  var a = [];
  var s = a;
  var l = false;
  function u() {
    if (s === a) {
      s = a.slice();
    }
  }
  function c() {
    return o;
  }
  function d(e) {
    if (typeof e != "function") {
      throw new Error("Expected listener to be a function.");
    }
    var t = true;
    u();
    s.push(e);
    return function () {
      if (t) {
        t = false;
        u();
        var n = s.indexOf(e);
        s.splice(n, 1);
      }
    };
  }
  function f(e) {
    if (!T(e)) {
      throw new Error("Actions must be plain objects. Use custom middleware for async actions.");
    }
    if (e.type === undefined) {
      throw new Error("Actions may not have an undefined \"type\" property. Have you misspelled a constant?");
    }
    if (l) {
      throw new Error("Reducers may not dispatch actions.");
    }
    try {
      l = true;
      o = i(o, e);
    } finally {
      l = false;
    }
    for (var t = a = s, n = 0; n < t.length; n++) {
      (0, t[n])();
    }
    return e;
  }
  f({
    type: ""
  });
  (r = {
    dispatch: f,
    subscribe: d,
    getState: c,
    replaceReducer: function (e) {
      if (typeof e != "function") {
        throw new Error("Expected the nextReducer to be a function.");
      }
      i = e;
      f({
        type: ""
      });
    }
  })[O] = function () {
    var e;
    var t = d;
    (e = {
      subscribe: function (e) {
        if (typeof e != "object") {
          throw new TypeError("Expected the observer to be an object.");
        }
        function n() {
          if (e.next) {
            e.next(c());
          }
        }
        n();
        return {
          unsubscribe: t(n)
        };
      }
    })[O] = function () {
      return this;
    };
    return e;
  };
  return r;
}
function I(e, t) {
  var n = t && t.type;
  return "Given action " + (n && "\"" + n.toString() + "\"" || "an action") + ", reducer \"" + e + "\" returned undefined. To ignore an action, you must explicitly return the previous state. If you want this reducer to hold no value, you can return null instead of undefined.";
}
export function combineReducers(e) {
  for (var t = Object.keys(e), n = {}, r = 0; r < t.length; r++) {
    var i = t[r];
    0;
    if (typeof e[i] == "function") {
      n[i] = e[i];
    }
  }
  var o = Object.keys(n);
  var a = undefined;
  try {
    (function (e) {
      Object.keys(e).forEach(function (t) {
        var n = e[t];
        if (n(undefined, {
          type: ""
        }) === undefined) {
          throw new Error("Reducer \"" + t + "\" returned undefined during initialization. If the state passed to the reducer is undefined, you must explicitly return the initial state. The initial state may not be undefined. If you don't want to set a value for this reducer, you can use null instead of undefined.");
        }
        if (n(undefined, {
          type: "@@redux/PROBE_UNKNOWN_ACTION_" + Math.random().toString(36).substring(7).split("").join(".")
        }) === undefined) {
          throw new Error("Reducer \"" + t + "\" returned undefined when probed with a random type. Don't try to handle @@redux/INIT or other actions in \"redux/*\" namespace. They are considered private. Instead, you must return the current state for any unknown actions, unless it is undefined, in which case you must return the initial state, regardless of the action type. The initial state may not be undefined, but can be null.");
        }
      });
    })(n);
  } catch (e) {
    a = e;
  }
  return function (e = {}) {
    var t = arguments[1];
    if (a) {
      throw a;
    }
    var r = false;
    var i = {};
    for (var s = 0; s < o.length; s++) {
      var l = o[s];
      var u = n[l];
      var c = e[l];
      var d = u(c, t);
      if (d === undefined) {
        var f = I(l, t);
        throw new Error(f);
      }
      i[l] = d;
      r = r || d !== c;
    }
    if (r) {
      return i;
    } else {
      return e;
    }
  };
}
function L(e, t) {
  return function () {
    return t(e.apply(undefined, arguments));
  };
}
export function bindActionCreators(e, t) {
  if (typeof e == "function") {
    return L(e, t);
  }
  if (typeof e != "object" || e === null) {
    throw new Error("bindActionCreators expected an object or a function, instead received " + (e === null ? "null" : typeof e) + ". Did you write \"import ActionCreators from\" instead of \"import * as ActionCreators from\"?");
  }
  for (var n = Object.keys(e), r = {}, i = 0; i < n.length; i++) {
    var o = n[i];
    var a = e[o];
    if (typeof a == "function") {
      r[o] = L(a, t);
    }
  }
  return r;
}
export function compose() {
  for (var e = arguments.length, t = Array(e), n = 0; n < e; n++) {
    t[n] = arguments[n];
  }
  if (t.length === 0) {
    return function (e) {
      return e;
    };
  } else if (t.length === 1) {
    return t[0];
  } else {
    return t.reduce(function (e, t) {
      return function () {
        return e(t.apply(undefined, arguments));
      };
    });
  }
}
var D = Object.assign || function (e) {
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
export function applyMiddleware() {
  for (var e = arguments.length, t = Array(e), n = 0; n < e; n++) {
    t[n] = arguments[n];
  }
  return function (e) {
    return function (n, r, i) {
      var o;
      var a = e(n, r, i);
      var s = a.dispatch;
      var l = {
        getState: a.getState,
        dispatch: function (e) {
          return s(e);
        }
      };
      o = t.map(function (e) {
        return e(l);
      });
      s = compose.apply(undefined, o)(a.dispatch);
      return D({}, a, {
        dispatch: s
      });
    };
  };
}