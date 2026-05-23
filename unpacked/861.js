Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, t) {
  if ("removeProperty" in e.style) {
    return e.style.removeProperty(t);
  } else {
    return e.style.removeAttribute(t);
  }
};
module.exports = exports.default;