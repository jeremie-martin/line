Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e) {
  return e.replace(r, "-$1").toLowerCase();
};
var r = /([A-Z])/g;
module.exports = exports.default;