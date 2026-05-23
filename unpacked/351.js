Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function () {
  function e(e, t) {
    return e.length - t.length;
  }
  return {
    onProcessStyle: function (t, n) {
      if (n.type !== "style") {
        return t;
      }
      var r = {};
      var i = Object.keys(t).sort(e);
      for (var o in i) {
        r[i[o]] = t[i[o]];
      }
      return r;
    }
  };
};