module.exports = function (e, t, n, r) {
  var i = e & 65535 | 0;
  var o = e >>> 16 & 65535 | 0;
  var a = 0;
  while (n !== 0) {
    n -= a = n > 2000 ? 2000 : n;
    do {
      o = o + (i = i + t[r++] | 0) | 0;
    } while (--a);
    i %= 65521;
    o %= 65521;
  }
  return i | o << 16 | 0;
};