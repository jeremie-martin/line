Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, t, n, r) {
  e.addEventListener(t, n, r);
  return {
    remove: function () {
      e.removeEventListener(t, n, r);
    }
  };
};