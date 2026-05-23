Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function () {
  return {
    onProcessStyle: function (e) {
      if (Array.isArray(e)) {
        for (var t = 0; t < e.length; t++) {
          e[t] = a(e[t]);
        }
        return e;
      }
      return a(e);
    },
    onChangeValue: function (e, t, n) {
      var r = (0, o.default)(t);
      if (t === r) {
        return e;
      } else {
        n.prop(r, e);
        return null;
      }
    }
  };
};
var r;
var i = require("./996.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
function a(e) {
  var t = {};
  for (var n in e) {
    t[(0, o.default)(n)] = e[n];
  }
  if (e.fallbacks) {
    if (Array.isArray(e.fallbacks)) {
      t.fallbacks = e.fallbacks.map(a);
    } else {
      t.fallbacks = a(e.fallbacks);
    }
  }
  return t;
}