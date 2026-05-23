exports.byteLength = function (e) {
  return e.length * 3 / 4 - u(e);
};
exports.toByteArray = function (e) {
  var t;
  var n;
  var r;
  var a;
  var s;
  var l = e.length;
  a = u(e);
  s = new o(l * 3 / 4 - a);
  n = a > 0 ? l - 4 : l;
  var c = 0;
  for (t = 0; t < n; t += 4) {
    r = i[e.charCodeAt(t)] << 18 | i[e.charCodeAt(t + 1)] << 12 | i[e.charCodeAt(t + 2)] << 6 | i[e.charCodeAt(t + 3)];
    s[c++] = r >> 16 & 255;
    s[c++] = r >> 8 & 255;
    s[c++] = r & 255;
  }
  if (a === 2) {
    r = i[e.charCodeAt(t)] << 2 | i[e.charCodeAt(t + 1)] >> 4;
    s[c++] = r & 255;
  } else if (a === 1) {
    r = i[e.charCodeAt(t)] << 10 | i[e.charCodeAt(t + 1)] << 4 | i[e.charCodeAt(t + 2)] >> 2;
    s[c++] = r >> 8 & 255;
    s[c++] = r & 255;
  }
  return s;
};
exports.fromByteArray = function (e) {
  var t;
  var n = e.length;
  var i = n % 3;
  var o = "";
  var a = [];
  for (var s = 0, l = n - i; s < l; s += 16383) {
    a.push(c(e, s, s + 16383 > l ? l : s + 16383));
  }
  if (i === 1) {
    t = e[n - 1];
    o += r[t >> 2];
    o += r[t << 4 & 63];
    o += "==";
  } else if (i === 2) {
    t = (e[n - 2] << 8) + e[n - 1];
    o += r[t >> 10];
    o += r[t >> 4 & 63];
    o += r[t << 2 & 63];
    o += "=";
  }
  a.push(o);
  return a.join("");
};
var r = [];
var i = [];
var o = typeof Uint8Array != "undefined" ? Uint8Array : Array;
var a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for (var s = 0, l = a.length; s < l; ++s) {
  r[s] = a[s];
  i[a.charCodeAt(s)] = s;
}
function u(e) {
  var t = e.length;
  if (t % 4 > 0) {
    throw new Error("Invalid string. Length must be a multiple of 4");
  }
  if (e[t - 2] === "=") {
    return 2;
  } else if (e[t - 1] === "=") {
    return 1;
  } else {
    return 0;
  }
}
function c(e, t, n) {
  var i;
  var o;
  var a = [];
  for (var s = t; s < n; s += 3) {
    i = (e[s] << 16) + (e[s + 1] << 8) + e[s + 2];
    a.push(r[(o = i) >> 18 & 63] + r[o >> 12 & 63] + r[o >> 6 & 63] + r[o & 63]);
  }
  return a.join("");
}
i["-".charCodeAt(0)] = 62;
i["_".charCodeAt(0)] = 63;