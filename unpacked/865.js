Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e) {
  if (e === e.window) {
    return e;
  } else {
    return e.nodeType === 9 && (e.defaultView || e.parentWindow);
  }
};
module.exports = exports.default;