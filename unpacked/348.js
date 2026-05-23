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
  var e = a(arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {});
  return {
    onProcessStyle: function (t, n) {
      if (n.type !== "style") {
        return t;
      }
      for (var r in t) {
        t[r] = l(r, t[r], e);
      }
      return t;
    },
    onChangeValue: function (t, n) {
      return l(n, t, e);
    }
  };
};
var i;
var o = require("./709.js");
function a(e) {
  var t = /(-[a-z])/g;
  function n(e) {
    return e[1].toUpperCase();
  }
  var r = {};
  for (var i in e) {
    r[i] = e[i];
    r[i.replace(t, n)] = e[i];
  }
  return r;
}
var s = a(((i = o) && i.__esModule ? i : {
  default: i
}).default);
function l(e, t, n) {
  if (!t) {
    return t;
  }
  var i = t;
  var o = t === undefined ? "undefined" : r(t);
  if (o === "object" && Array.isArray(t)) {
    o = "array";
  }
  switch (o) {
    case "object":
      if (e === "fallbacks") {
        for (var a in t) {
          t[a] = l(a, t[a], n);
        }
        break;
      }
      for (var u in t) {
        t[u] = l(e + "-" + u, t[u], n);
      }
      break;
    case "array":
      for (var c = 0; c < t.length; c++) {
        t[c] = l(e, t[c], n);
      }
      break;
    case "number":
      if (t !== 0) {
        i = t + (n[e] || s[e] || "");
      }
  }
  return i;
}