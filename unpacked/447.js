module.exports = function (e, t, n) {
  var r = n === undefined;
  switch (t.length) {
    case 0:
      if (r) {
        return e();
      } else {
        return e.call(n);
      }
    case 1:
      if (r) {
        return e(t[0]);
      } else {
        return e.call(n, t[0]);
      }
    case 2:
      if (r) {
        return e(t[0], t[1]);
      } else {
        return e.call(n, t[0], t[1]);
      }
    case 3:
      if (r) {
        return e(t[0], t[1], t[2]);
      } else {
        return e.call(n, t[0], t[1], t[2]);
      }
    case 4:
      if (r) {
        return e(t[0], t[1], t[2], t[3]);
      } else {
        return e.call(n, t[0], t[1], t[2], t[3]);
      }
  }
  return e.apply(n, t);
};