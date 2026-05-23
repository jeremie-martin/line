Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function (e) {
  return typeof e;
} : function (e) {
  if (e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype) {
    return "symbol";
  } else {
    return typeof e;
  }
};
exports.default = function () {
  return {
    onProcessStyle: function (e, t) {
      if (!e || t.type !== "style") {
        return e;
      }
      if (Array.isArray(e)) {
        for (var n = 0; n < e.length; n++) {
          e[n] = l(e[n], t);
        }
        return e;
      }
      return l(e, t);
    }
  };
};
var i = require("./998.js");
function o(e, t, n) {
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
function a(e, t, n, i) {
  if (n[t] == null) {
    return e.join(",");
  } else if (e.length === 0) {
    return "";
  } else if (Array.isArray(e[0])) {
    return a(e[0], t, n);
  } else if (r(e[0]) === "object") {
    return function (e, t, n) {
      return e.map(function (e) {
        return s(e, t, n);
      });
    }(e, t, i);
  } else {
    return e.join(" ");
  }
}
function s(e, t, n, r) {
  if (!i.propObj[t] && !i.customPropObj[t]) {
    return "";
  }
  var s = [];
  if (i.customPropObj[t]) {
    e = function (e, t, n, r) {
      for (var i in n) {
        var a = n[i];
        if (e[i] !== undefined && (r || !t.prop(a))) {
          var s = l(o({}, a, e[i]), t)[a];
          if (r) {
            t.style.fallbacks[a] = s;
          } else {
            t.style[a] = s;
          }
        }
        delete e[i];
      }
      return e;
    }(e, n, i.customPropObj[t], r);
  }
  if (Object.keys(e).length) {
    for (var u in i.propObj[t]) {
      if (e[u]) {
        if (Array.isArray(e[u])) {
          s.push(a(e[u], u, i.propArrayInObj));
        } else {
          s.push(e[u]);
        }
      } else if (i.propObj[t][u] != null) {
        s.push(i.propObj[t][u]);
      }
    }
  }
  return s.join(" ");
}
function l(e, t, n) {
  for (var o in e) {
    var u = e[o];
    if (Array.isArray(u)) {
      if (!Array.isArray(u[0])) {
        if (o === "fallbacks") {
          for (var c = 0; c < e.fallbacks.length; c++) {
            e.fallbacks[c] = l(e.fallbacks[c], t, true);
          }
          continue;
        }
        e[o] = a(u, o, i.propArray);
        if (!e[o]) {
          delete e[o];
        }
      }
    } else if ((u === undefined ? "undefined" : r(u)) === "object") {
      if (o === "fallbacks") {
        e.fallbacks = l(e.fallbacks, t, true);
        continue;
      }
      e[o] = s(u, o, t, n);
      if (!e[o]) {
        delete e[o];
      }
    } else if (e[o] === "") {
      delete e[o];
    }
  }
  return e;
}