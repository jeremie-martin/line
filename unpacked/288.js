exports.findIndexWithBinarySearch = function (e, t, n) {
  var r;
  for (var i = 0, o = e.length - 1; i <= o;) {
    var a = n(e[r = (i + o) / 2 | 0], r) - t;
    if (a < 0) {
      i = r + 1;
    } else {
      if (!(a > 0)) {
        while (r < e.length - 1 && n(e[r + 1], r + 1) == t) {
          ++r;
        }
        return r;
      }
      o = r - 1;
    }
  }
  return -1;
};
exports.findInsertionIndexWithBinarySearch = function (e, t, n) {
  if (e.length == 0) {
    return 0;
  }
  var r;
  var i = 0;
  var o = e.length - 1;
  if (t > n(e[o], o)) {
    return e.length;
  }
  while (i <= o) {
    var a;
    if ((a = n(e[r = (i + o) / 2 | 0], r) - t) < 0) {
      i = r + 1;
    } else {
      if (!(a > 0)) {
        while (r < e.length - 1 && n(e[r + 1], r + 1) == t) {
          ++r;
        }
        return r + 1;
      }
      o = r - 1;
    }
  }
  if ((a = n(e[r], r) - t) > 0) {
    return r;
  } else {
    return r + 1;
  }
};