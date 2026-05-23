Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, t, n, r) {
  return function (i) {
    if (r) {
      r.call(e, i);
    }
    return !i.defaultPrevented && (e.ripple && e.ripple[n](i), e.props && typeof e.props["on" + t] == "function" && e.props["on" + t](i), true);
  };
};