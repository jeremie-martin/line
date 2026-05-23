function n(e, t) {
  var n = (e & 65535) + (t & 65535);
  return (e >> 16) + (t >> 16) + (n >> 16) << 16 | n & 65535;
}
function r(e, t, r, i, o, a) {
  return n((s = n(n(t, e), n(i, a))) << (l = o) | s >>> 32 - l, r);
  var s;
  var l;
}
function i(e, t, n, i, o, a, s) {
  return r(t & n | ~t & i, e, t, o, a, s);
}
function o(e, t, n, i, o, a, s) {
  return r(t & i | n & ~i, e, t, o, a, s);
}
function a(e, t, n, i, o, a, s) {
  return r(t ^ n ^ i, e, t, o, a, s);
}
function s(e, t, n, i, o, a, s) {
  return r(n ^ (t | ~i), e, t, o, a, s);
}
function l(e, t) {
  var r;
  var l;
  var u;
  var c;
  var d;
  e[t >> 5] |= 128 << t % 32;
  e[14 + (t + 64 >>> 9 << 4)] = t;
  var f = 1732584193;
  var p = -271733879;
  var h = -1732584194;
  var m = 271733878;
  for (r = 0; r < e.length; r += 16) {
    l = f;
    u = p;
    c = h;
    d = m;
    p = s(p = s(p = s(p = s(p = a(p = a(p = a(p = a(p = o(p = o(p = o(p = o(p = i(p = i(p = i(p = i(p, h = i(h, m = i(m, f = i(f, p, h, m, e[r], 7, -680876936), p, h, e[r + 1], 12, -389564586), f, p, e[r + 2], 17, 606105819), m, f, e[r + 3], 22, -1044525330), h = i(h, m = i(m, f = i(f, p, h, m, e[r + 4], 7, -176418897), p, h, e[r + 5], 12, 1200080426), f, p, e[r + 6], 17, -1473231341), m, f, e[r + 7], 22, -45705983), h = i(h, m = i(m, f = i(f, p, h, m, e[r + 8], 7, 1770035416), p, h, e[r + 9], 12, -1958414417), f, p, e[r + 10], 17, -42063), m, f, e[r + 11], 22, -1990404162), h = i(h, m = i(m, f = i(f, p, h, m, e[r + 12], 7, 1804603682), p, h, e[r + 13], 12, -40341101), f, p, e[r + 14], 17, -1502002290), m, f, e[r + 15], 22, 1236535329), h = o(h, m = o(m, f = o(f, p, h, m, e[r + 1], 5, -165796510), p, h, e[r + 6], 9, -1069501632), f, p, e[r + 11], 14, 643717713), m, f, e[r], 20, -373897302), h = o(h, m = o(m, f = o(f, p, h, m, e[r + 5], 5, -701558691), p, h, e[r + 10], 9, 38016083), f, p, e[r + 15], 14, -660478335), m, f, e[r + 4], 20, -405537848), h = o(h, m = o(m, f = o(f, p, h, m, e[r + 9], 5, 568446438), p, h, e[r + 14], 9, -1019803690), f, p, e[r + 3], 14, -187363961), m, f, e[r + 8], 20, 1163531501), h = o(h, m = o(m, f = o(f, p, h, m, e[r + 13], 5, -1444681467), p, h, e[r + 2], 9, -51403784), f, p, e[r + 7], 14, 1735328473), m, f, e[r + 12], 20, -1926607734), h = a(h, m = a(m, f = a(f, p, h, m, e[r + 5], 4, -378558), p, h, e[r + 8], 11, -2022574463), f, p, e[r + 11], 16, 1839030562), m, f, e[r + 14], 23, -35309556), h = a(h, m = a(m, f = a(f, p, h, m, e[r + 1], 4, -1530992060), p, h, e[r + 4], 11, 1272893353), f, p, e[r + 7], 16, -155497632), m, f, e[r + 10], 23, -1094730640), h = a(h, m = a(m, f = a(f, p, h, m, e[r + 13], 4, 681279174), p, h, e[r], 11, -358537222), f, p, e[r + 3], 16, -722521979), m, f, e[r + 6], 23, 76029189), h = a(h, m = a(m, f = a(f, p, h, m, e[r + 9], 4, -640364487), p, h, e[r + 12], 11, -421815835), f, p, e[r + 15], 16, 530742520), m, f, e[r + 2], 23, -995338651), h = s(h, m = s(m, f = s(f, p, h, m, e[r], 6, -198630844), p, h, e[r + 7], 10, 1126891415), f, p, e[r + 14], 15, -1416354905), m, f, e[r + 5], 21, -57434055), h = s(h, m = s(m, f = s(f, p, h, m, e[r + 12], 6, 1700485571), p, h, e[r + 3], 10, -1894986606), f, p, e[r + 10], 15, -1051523), m, f, e[r + 1], 21, -2054922799), h = s(h, m = s(m, f = s(f, p, h, m, e[r + 8], 6, 1873313359), p, h, e[r + 15], 10, -30611744), f, p, e[r + 6], 15, -1560198380), m, f, e[r + 13], 21, 1309151649), h = s(h, m = s(m, f = s(f, p, h, m, e[r + 4], 6, -145523070), p, h, e[r + 11], 10, -1120210379), f, p, e[r + 2], 15, 718787259), m, f, e[r + 9], 21, -343485551);
    f = n(f, l);
    p = n(p, u);
    h = n(h, c);
    m = n(m, d);
  }
  return [f, p, h, m];
}
function u(e) {
  var t;
  var n = "";
  var r = e.length * 32;
  for (t = 0; t < r; t += 8) {
    n += String.fromCharCode(e[t >> 5] >>> t % 32 & 255);
  }
  return n;
}
function c(e) {
  var t;
  var n = [];
  n[(e.length >> 2) - 1] = undefined;
  t = 0;
  for (; t < n.length; t += 1) {
    n[t] = 0;
  }
  var r = e.length * 8;
  for (t = 0; t < r; t += 8) {
    n[t >> 5] |= (e.charCodeAt(t / 8) & 255) << t % 32;
  }
  return n;
}
function d(e) {
  var t;
  var n;
  var r = "";
  for (n = 0; n < e.length; n += 1) {
    t = e.charCodeAt(n);
    r += "0123456789abcdef".charAt(t >>> 4 & 15) + "0123456789abcdef".charAt(t & 15);
  }
  return r;
}
function f(e) {
  return unescape(encodeURIComponent(e));
}
function p(e) {
  return function (e) {
    return u(l(c(e), e.length * 8));
  }(f(e));
}
function h(e, t) {
  return function (e, t) {
    var n;
    var r;
    var i = c(e);
    var o = [];
    var a = [];
    o[15] = a[15] = undefined;
    if (i.length > 16) {
      i = l(i, e.length * 8);
    }
    n = 0;
    for (; n < 16; n += 1) {
      o[n] = i[n] ^ 909522486;
      a[n] = i[n] ^ 1549556828;
    }
    r = l(o.concat(c(t)), 512 + t.length * 8);
    return u(l(a.concat(r), 640));
  }(f(e), f(t));
}
module.exports = function (e, t, n) {
  if (t) {
    if (n) {
      return h(t, e);
    } else {
      return d(h(t, e));
    }
  } else if (n) {
    return p(e);
  } else {
    return d(p(e));
  }
};