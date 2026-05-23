Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function () {
  return {
    onProcessStyle: function (e) {
      if (Array.isArray(e)) {
        for (var t = 0; t < e.length; t++) {
          e[t] = o(e[t]);
        }
        return e;
      }
      return o(e);
    }
  };
};
var r = /([A-Z])/g;
function i(e) {
  return "-" + e.toLowerCase();
}
function o(e) {
  var t = {};
  for (var n in e) {
    t[n.replace(r, i)] = e[n];
  }
  if (e.fallbacks) {
    if (Array.isArray(e.fallbacks)) {
      t.fallbacks = e.fallbacks.map(o);
    } else {
      t.fallbacks = o(e.fallbacks);
    }
  }
  return t;
}