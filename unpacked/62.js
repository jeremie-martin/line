Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e) {
  return e && e.ownerDocument || document;
};
module.exports = exports.default;