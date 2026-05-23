Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function () {
  return {
    onProcessRule: function (e) {
      if (e.type === "keyframes") {
        e.key = "@" + r.prefix.css + e.key.substr(1);
      }
    },
    onProcessStyle: function (e, t) {
      if (t.type !== "style") {
        return e;
      }
      for (var n in e) {
        var i = e[n];
        var o = false;
        var a = r.supportedProperty(n);
        if (a && a !== n) {
          o = true;
        }
        var s = false;
        var l = r.supportedValue(a, i);
        if (l && l !== i) {
          s = true;
        }
        if (o || s) {
          if (o) {
            delete e[n];
          }
          e[a || n] = l || i;
        }
      }
      return e;
    },
    onChangeValue: function (e, t) {
      return r.supportedValue(t, e);
    }
  };
};
var r = function (e) {
  if (e && e.__esModule) {
    return e;
  }
  var t = {};
  if (e != null) {
    for (var n in e) {
      if (Object.prototype.hasOwnProperty.call(e, n)) {
        t[n] = e[n];
      }
    }
  }
  t.default = e;
  return t;
}(require("./350.js"));