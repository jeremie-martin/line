var r = function () {
  var e;
  var t = [];
  for (var n = 0; n < 256; n++) {
    e = n;
    for (var r = 0; r < 8; r++) {
      e = e & 1 ? e >>> 1 ^ -306674912 : e >>> 1;
    }
    t[n] = e;
  }
  return t;
}();
module.exports = function (e, t, n, i) {
  var o = r;
  var a = i + n;
  e ^= -1;
  for (var s = i; s < a; s++) {
    e = e >>> 8 ^ o[(e ^ t[s]) & 255];
  }
  return e ^ -1;
};