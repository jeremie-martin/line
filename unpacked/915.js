Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e) {
  return function (t) {
    return function (n, r, i, o, a) {
      var s = a || r;
      if (n[r] === undefined || n[t]) {
        return null;
      } else {
        return new Error("The property `" + s + "` of `" + e + "` must be used on `" + t + "`.");
      }
    };
  };
};