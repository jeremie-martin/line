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
    onProcessStyle: function (e, t, n) {
      if ("extend" in e) {
        return u(e, t, n);
      } else {
        return e;
      }
    },
    onChangeValue: function (e, t, n) {
      if (t !== "extend") {
        return e;
      }
      if (e == null || e === false) {
        for (var r in n[l]) {
          n.prop(r, null);
        }
        n[l] = null;
        return null;
      }
      for (var i in e) {
        n.prop(i, e[i]);
      }
      n[l] = e;
      return null;
    }
  };
};
var i;
var o = require("./14.js");
var a = (i = o) && i.__esModule ? i : {
  default: i
};
function s(e) {
  return e && (e === undefined ? "undefined" : r(e)) === "object" && !Array.isArray(e);
}
var l = "extendCurrValue" + Date.now();
function u(e, t, n, i = {}) {
  (function (e, t, n, i) {
    if (r(e.extend) !== "string") {
      if (Array.isArray(e.extend)) {
        for (var o = 0; o < e.extend.length; o++) {
          u(e.extend[o], t, n, i);
        }
      } else {
        for (var l in e.extend) {
          if (l !== "extend") {
            if (s(e.extend[l])) {
              if (!(l in i)) {
                i[l] = {};
              }
              u(e.extend[l], t, n, i[l]);
            } else {
              i[l] = e.extend[l];
            }
          } else {
            u(e.extend.extend, t, n, i);
          }
        }
      }
    } else {
      if (!n) {
        return;
      }
      var c = n.getRule(e.extend);
      if (!c) {
        return;
      }
      if (c === t) {
        (0, a.default)(false, "[JSS] A rule tries to extend itself \r\n%s", t);
        return;
      }
      var d = c.options.parent;
      if (d) {
        u(d.rules.raw[e.extend], t, n, i);
      }
    }
  })(e, t, n, i);
  (function (e, t, n, r) {
    for (var i in e) {
      if (i !== "extend") {
        if (s(r[i]) && s(e[i])) {
          u(e[i], t, n, r[i]);
        } else if (s(e[i])) {
          r[i] = u(e[i], t, n);
        } else {
          r[i] = e[i];
        }
      }
    }
  })(e, t, n, i);
  return i;
}