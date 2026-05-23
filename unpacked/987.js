Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./131.js"));
var i = a(require("./97.js"));
var o = a(require("./179.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var s = Date.now();
var l = "fnValues" + s;
var u = "fnStyle" + ++s;
exports.default = {
  onCreateRule: function (e, t, n) {
    if (typeof t != "function") {
      return null;
    }
    var r = (0, o.default)(e, {}, n);
    r[u] = t;
    return r;
  },
  onProcessStyle: function (e, t) {
    var n = {};
    for (var r in e) {
      var i = e[r];
      if (typeof i == "function") {
        delete e[r];
        n[r] = i;
      }
    }
    (t = t)[l] = n;
    return e;
  },
  onUpdate: function (e, t) {
    if (t.rules instanceof r.default) {
      t.rules.update(e);
    } else if (t instanceof i.default) {
      if ((t = t)[l]) {
        for (var n in t[l]) {
          t.prop(n, t[l][n](e));
        }
      }
      var o = (t = t)[u];
      if (o) {
        var a = o(e);
        for (var s in a) {
          t.prop(s, a[s]);
        }
      }
    }
  }
};