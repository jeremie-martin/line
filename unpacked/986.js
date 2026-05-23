Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./97.js"));
var i = a(require("./179.js"));
var o = a(require("./407.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = {
  onCreateRule: function (e, t, n) {
    if (!(0, o.default)(t)) {
      return null;
    }
    var r = t;
    var a = (0, i.default)(e, {}, n);
    r.subscribe(function (e) {
      for (var t in e) {
        a.prop(t, e[t]);
      }
    });
    return a;
  },
  onProcessRule: function (e) {
    if (e instanceof r.default) {
      var t = e;
      var n = t.style;
      function i(e) {
        var r = n[e];
        if (!(0, o.default)(r)) {
          return "continue";
        }
        delete n[e];
        r.subscribe({
          next: function (n) {
            t.prop(e, n);
          }
        });
      }
      for (var a in n) {
        i(a);
      }
    }
  }
};