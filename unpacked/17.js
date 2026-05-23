function r(e, t) {
  return e === t;
}
function i(e, t = r) {
  var n = null;
  var i = null;
  return function () {
    if (!function (e, t, n) {
      if (t === null || n === null || t.length !== n.length) {
        return false;
      }
      for (var r = t.length, i = 0; i < r; i++) {
        if (!e(t[i], n[i])) {
          return false;
        }
      }
      return true;
    }(t, n, arguments)) {
      i = e.apply(null, arguments);
    }
    n = arguments;
    return i;
  };
}
function o(e) {
  for (var t = arguments.length, n = Array(t > 1 ? t - 1 : 0), r = 1; r < t; r++) {
    n[r - 1] = arguments[r];
  }
  return function () {
    for (var t = arguments.length, r = Array(t), o = 0; o < t; o++) {
      r[o] = arguments[o];
    }
    var a = 0;
    var s = r.pop();
    var l = function (e) {
      var t = Array.isArray(e[0]) ? e[0] : e;
      if (!t.every(function (e) {
        return typeof e == "function";
      })) {
        var n = t.map(function (e) {
          return typeof e;
        }).join(", ");
        throw new Error("Selector creators expect all input-selectors to be functions, instead received the following types: [" + n + "]");
      }
      return t;
    }(r);
    var u = e.apply(undefined, [function () {
      a++;
      return s.apply(null, arguments);
    }].concat(n));
    var c = i(function () {
      var e = [];
      for (var t = l.length, n = 0; n < t; n++) {
        e.push(l[n].apply(null, arguments));
      }
      return u.apply(null, e);
    });
    c.resultFunc = s;
    c.recomputations = function () {
      return a;
    };
    c.resetRecomputations = function () {
      return a = 0;
    };
    return c;
  };
}
exports.__esModule = true;
exports.defaultMemoize = i;
exports.createSelectorCreator = o;
exports.createStructuredSelector = function (e, t = a) {
  if (typeof e != "object") {
    throw new Error("createStructuredSelector expects first argument to be an object where each property is a selector, instead received a " + typeof e);
  }
  var n = Object.keys(e);
  return t(n.map(function (t) {
    return e[t];
  }), function () {
    for (var e = arguments.length, t = Array(e), r = 0; r < e; r++) {
      t[r] = arguments[r];
    }
    return t.reduce(function (e, t, r) {
      e[n[r]] = t;
      return e;
    }, {});
  });
};
var a = exports.createSelector = o(i);