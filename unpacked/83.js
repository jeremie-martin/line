Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getDiff = function (e, t) {
  if (t === 0) {
    return 0;
  } else {
    return (t - e) / t;
  }
};