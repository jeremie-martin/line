module.exports = function (e, t, n) {
  var r = -1;
  var i = e.length;
  if (t < 0) {
    t = -t > i ? 0 : i + t;
  }
  if ((n = n > i ? i : n) < 0) {
    n += i;
  }
  i = t > n ? 0 : n - t >>> 0;
  t >>>= 0;
  var o = Array(i);
  while (++r < i) {
    o[r] = e[r + t];
  }
  return o;
};