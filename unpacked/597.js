exports.read = function (e, t, n, r, i) {
  var o;
  var a;
  var s = i * 8 - r - 1;
  var l = (1 << s) - 1;
  var u = l >> 1;
  var c = -7;
  var d = n ? i - 1 : 0;
  var f = n ? -1 : 1;
  var p = e[t + d];
  d += f;
  o = p & (1 << -c) - 1;
  p >>= -c;
  c += s;
  for (; c > 0; c -= 8) {
    o = o * 256 + e[t + d];
    d += f;
  }
  a = o & (1 << -c) - 1;
  o >>= -c;
  c += r;
  for (; c > 0; c -= 8) {
    a = a * 256 + e[t + d];
    d += f;
  }
  if (o === 0) {
    o = 1 - u;
  } else {
    if (o === l) {
      if (a) {
        return NaN;
      } else {
        return (p ? -1 : 1) * Infinity;
      }
    }
    a += Math.pow(2, r);
    o -= u;
  }
  return (p ? -1 : 1) * a * Math.pow(2, o - r);
};
exports.write = function (e, t, n, r, i, o) {
  var a;
  var s;
  var l;
  var u = o * 8 - i - 1;
  var c = (1 << u) - 1;
  var d = c >> 1;
  var f = i === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
  var p = r ? 0 : o - 1;
  var h = r ? 1 : -1;
  var m = t < 0 || t === 0 && 1 / t < 0 ? 1 : 0;
  t = Math.abs(t);
  if (isNaN(t) || t === Infinity) {
    s = isNaN(t) ? 1 : 0;
    a = c;
  } else {
    a = Math.floor(Math.log(t) / Math.LN2);
    if (t * (l = Math.pow(2, -a)) < 1) {
      a--;
      l *= 2;
    }
    if ((t += a + d >= 1 ? f / l : f * Math.pow(2, 1 - d)) * l >= 2) {
      a++;
      l /= 2;
    }
    if (a + d >= c) {
      s = 0;
      a = c;
    } else if (a + d >= 1) {
      s = (t * l - 1) * Math.pow(2, i);
      a += d;
    } else {
      s = t * Math.pow(2, d - 1) * Math.pow(2, i);
      a = 0;
    }
  }
  for (; i >= 8; i -= 8) {
    e[n + p] = s & 255;
    p += h;
    s /= 256;
  }
  a = a << i | s;
  u += i;
  for (; u > 0; u -= 8) {
    e[n + p] = a & 255;
    p += h;
    a /= 256;
  }
  e[n + p - h] |= m * 128;
};