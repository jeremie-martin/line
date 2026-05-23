Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, t) {
  for (var n in t) {
    var r = e[n];
    if (!r) {
      break;
    }
    if (typeof t[n] != "function") {
      t[n].composes = r;
    } else {
      t[n] = {
        extend: t[n],
        composes: r
      };
    }
  }
  if (t) {
    for (var i in e) {
      t[i] ||= {
        composes: e[i]
      };
    }
  }
  return t;
};