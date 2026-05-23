var r = require("./150.js");
var i = true;
var o = true;
try {
  String.fromCharCode.apply(null, [0]);
} catch (e) {
  i = false;
}
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch (e) {
  o = false;
}
var a = new r.Buf8(256);
for (var s = 0; s < 256; s++) {
  a[s] = s >= 252 ? 6 : s >= 248 ? 5 : s >= 240 ? 4 : s >= 224 ? 3 : s >= 192 ? 2 : 1;
}
function l(e, t) {
  if (t < 65537 && (e.subarray && o || !e.subarray && i)) {
    return String.fromCharCode.apply(null, r.shrinkBuf(e, t));
  }
  var n = "";
  for (var a = 0; a < t; a++) {
    n += String.fromCharCode(e[a]);
  }
  return n;
}
a[254] = a[254] = 1;
exports.string2buf = function (e) {
  var t;
  var n;
  var i;
  var o;
  var a;
  var s = e.length;
  var l = 0;
  for (o = 0; o < s; o++) {
    if (((n = e.charCodeAt(o)) & 64512) == 55296 && o + 1 < s && ((i = e.charCodeAt(o + 1)) & 64512) == 56320) {
      n = 65536 + (n - 55296 << 10) + (i - 56320);
      o++;
    }
    l += n < 128 ? 1 : n < 2048 ? 2 : n < 65536 ? 3 : 4;
  }
  t = new r.Buf8(l);
  a = 0;
  o = 0;
  for (; a < l; o++) {
    if (((n = e.charCodeAt(o)) & 64512) == 55296 && o + 1 < s && ((i = e.charCodeAt(o + 1)) & 64512) == 56320) {
      n = 65536 + (n - 55296 << 10) + (i - 56320);
      o++;
    }
    if (n < 128) {
      t[a++] = n;
    } else if (n < 2048) {
      t[a++] = n >>> 6 | 192;
      t[a++] = n & 63 | 128;
    } else if (n < 65536) {
      t[a++] = n >>> 12 | 224;
      t[a++] = n >>> 6 & 63 | 128;
      t[a++] = n & 63 | 128;
    } else {
      t[a++] = n >>> 18 | 240;
      t[a++] = n >>> 12 & 63 | 128;
      t[a++] = n >>> 6 & 63 | 128;
      t[a++] = n & 63 | 128;
    }
  }
  return t;
};
exports.buf2binstring = function (e) {
  return l(e, e.length);
};
exports.binstring2buf = function (e) {
  var t = new r.Buf8(e.length);
  for (var n = 0, i = t.length; n < i; n++) {
    t[n] = e.charCodeAt(n);
  }
  return t;
};
exports.buf2string = function (e, t) {
  var n;
  var r;
  var i;
  var o;
  var s = t || e.length;
  var u = new Array(s * 2);
  r = 0;
  n = 0;
  while (n < s) {
    if ((i = e[n++]) < 128) {
      u[r++] = i;
    } else if ((o = a[i]) > 4) {
      u[r++] = 65533;
      n += o - 1;
    } else {
      for (i &= o === 2 ? 31 : o === 3 ? 15 : 7; o > 1 && n < s;) {
        i = i << 6 | e[n++] & 63;
        o--;
      }
      if (o > 1) {
        u[r++] = 65533;
      } else if (i < 65536) {
        u[r++] = i;
      } else {
        i -= 65536;
        u[r++] = i >> 10 & 1023 | 55296;
        u[r++] = i & 1023 | 56320;
      }
    }
  }
  return l(u, r);
};
exports.utf8border = function (e, t) {
  var n;
  if ((t = t || e.length) > e.length) {
    t = e.length;
  }
  n = t - 1;
  while (n >= 0 && (e[n] & 192) == 128) {
    n--;
  }
  if (n < 0) {
    return t;
  } else if (n === 0) {
    return t;
  } else if (n + a[e[n]] > t) {
    return n;
  } else {
    return t;
  }
};