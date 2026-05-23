Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = s(require("./120.js"));
var i = s(require("./86.js"));
var o = s(require("./705.js"));
var a = s(require("./161.js"));
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var l = Date.now();
var u = "fnValues" + l;
var c = "fnStyle" + ++l;
exports.default = {
  onCreateRule: function (e, t, n) {
    if (typeof t != "function") {
      return null;
    }
    var r = (0, a.default)(e, {}, n);
    r[c] = t;
    return r;
  },
  onProcessStyle: function (e, t) {
    var n = {};
    for (var r in e) {
      var i = e[r];
      if (typeof i == "function") {
        delete e[r];
        n[(0, o.default)(r)] = i;
      }
    }
    (t = t)[u] = n;
    return e;
  },
  onUpdate: function (e, t) {
    if (t.rules instanceof r.default) {
      t.rules.update(e);
    } else if (t instanceof i.default) {
      if ((t = t)[u]) {
        for (var n in t[u]) {
          t.prop(n, t[u][n](e));
        }
      }
      var o = (t = t)[c];
      if (o) {
        var a = o(e);
        for (var s in a) {
          t.prop(s, a[s]);
        }
      }
    }
  }
};