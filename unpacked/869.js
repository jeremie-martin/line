Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, t) {
  if (e.classList) {
    return !!t && e.classList.contains(t);
  } else {
    return (" " + (e.className.baseVal || e.className) + " ").indexOf(" " + t + " ") !== -1;
  }
};
module.exports = exports.default;