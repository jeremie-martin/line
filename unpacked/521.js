Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hashIntPair = function (e, t) {
  let n = e >= 0 ? e * 2 : e * -2 - 1;
  let r = t >= 0 ? t * 2 : t * -2 - 1;
  let i = n >= r ? n * n + n + r : r * r + n;
  if (i & 1) {
    return -(i - 1) / 2 - 1;
  } else {
    return i / 2;
  }
};