exports.__esModule = true;
exports.default = function (e, t) {
  var n = {};
  for (var r in e) {
    if (!(t.indexOf(r) >= 0)) {
      if (Object.prototype.hasOwnProperty.call(e, r)) {
        n[r] = e[r];
      }
    }
  }
  return n;
};