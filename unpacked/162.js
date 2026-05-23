function r(e) {
  return function (e) {
    return !!e && typeof e == "object";
  }(e) && !function (e) {
    var t = Object.prototype.toString.call(e);
    return t === "[object RegExp]" || t === "[object Date]" || function (e) {
      return e.$$typeof === i;
    }(e);
  }(e);
}
var i = typeof Symbol == "function" && Symbol.for ? Symbol.for("react.element") : 60103;
function o(e, t) {
  var n;
  if ((!t || t.clone !== false) && r(e)) {
    return s((n = e, Array.isArray(n) ? [] : {}), e, t);
  } else {
    return e;
  }
}
function a(e, t, n) {
  return e.concat(t).map(function (e) {
    return o(e, n);
  });
}
function s(e, t, n) {
  var i = Array.isArray(t);
  if (i === Array.isArray(e)) {
    if (i) {
      return ((n || {
        arrayMerge: a
      }).arrayMerge || a)(e, t, n);
    } else {
      return function (e, t, n) {
        var i = {};
        if (r(e)) {
          Object.keys(e).forEach(function (t) {
            i[t] = o(e[t], n);
          });
        }
        Object.keys(t).forEach(function (a) {
          if (r(t[a]) && e[a]) {
            i[a] = s(e[a], t[a], n);
          } else {
            i[a] = o(t[a], n);
          }
        });
        return i;
      }(e, t, n);
    }
  } else {
    return o(t, n);
  }
}
s.all = function (e, t) {
  if (!Array.isArray(e)) {
    throw new Error("first argument should be an array");
  }
  return e.reduce(function (e, n) {
    return s(e, n, t);
  }, {});
};
var l = s;
exports.default = l;