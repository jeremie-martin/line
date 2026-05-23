Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e) {
  return e.replace(r, function (e, t) {
    return t.toUpperCase();
  });
};
var r = /-(.)/g;
module.exports = exports.default;