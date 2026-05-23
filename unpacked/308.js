var e = require("./18.js");
var r = require("./596.js");
var i = require("./597.js");
var o = require("./598.js");
function a() {
  if (l.TYPED_ARRAY_SUPPORT) {
    return 2147483647;
  } else {
    return 1073741823;
  }
}
function s(e, t) {
  if (a() < t) {
    throw new RangeError("Invalid typed array length");
  }
  if (l.TYPED_ARRAY_SUPPORT) {
    (e = new Uint8Array(t)).__proto__ = l.prototype;
  } else {
    if (e === null) {
      e = new l(t);
    }
    e.length = t;
  }
  return e;
}
function l(e, t, n) {
  if (!l.TYPED_ARRAY_SUPPORT && !(this instanceof l)) {
    return new l(e, t, n);
  }
  if (typeof e == "number") {
    if (typeof t == "string") {
      throw new Error("If encoding is specified then the first argument must be a string");
    }
    return d(this, e);
  }
  return u(this, e, t, n);
}
function u(e, t, n, r) {
  if (typeof t == "number") {
    throw new TypeError("\"value\" argument must not be a number");
  }
  if (typeof ArrayBuffer != "undefined" && t instanceof ArrayBuffer) {
    return function (e, t, n, r) {
      t.byteLength;
      if (n < 0 || t.byteLength < n) {
        throw new RangeError("'offset' is out of bounds");
      }
      if (t.byteLength < n + (r || 0)) {
        throw new RangeError("'length' is out of bounds");
      }
      t = n === undefined && r === undefined ? new Uint8Array(t) : r === undefined ? new Uint8Array(t, n) : new Uint8Array(t, n, r);
      if (l.TYPED_ARRAY_SUPPORT) {
        (e = t).__proto__ = l.prototype;
      } else {
        e = f(e, t);
      }
      return e;
    }(e, t, n, r);
  } else if (typeof t == "string") {
    return function (e, t, n) {
      if (typeof n != "string" || n === "") {
        n = "utf8";
      }
      if (!l.isEncoding(n)) {
        throw new TypeError("\"encoding\" must be a valid string encoding");
      }
      var r = h(t, n) | 0;
      var i = (e = s(e, r)).write(t, n);
      if (i !== r) {
        e = e.slice(0, i);
      }
      return e;
    }(e, t, n);
  } else {
    return function (e, t) {
      if (l.isBuffer(t)) {
        var n = p(t.length) | 0;
        if ((e = s(e, n)).length === 0) {
          return e;
        } else {
          t.copy(e, 0, 0, n);
          return e;
        }
      }
      if (t) {
        if (typeof ArrayBuffer != "undefined" && t.buffer instanceof ArrayBuffer || "length" in t) {
          if (typeof t.length != "number" || (r = t.length) != r) {
            return s(e, 0);
          } else {
            return f(e, t);
          }
        }
        if (t.type === "Buffer" && o(t.data)) {
          return f(e, t.data);
        }
      }
      var r;
      throw new TypeError("First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.");
    }(e, t);
  }
}
function c(e) {
  if (typeof e != "number") {
    throw new TypeError("\"size\" argument must be a number");
  }
  if (e < 0) {
    throw new RangeError("\"size\" argument must not be negative");
  }
}
function d(e, t) {
  c(t);
  e = s(e, t < 0 ? 0 : p(t) | 0);
  if (!l.TYPED_ARRAY_SUPPORT) {
    for (var n = 0; n < t; ++n) {
      e[n] = 0;
    }
  }
  return e;
}
function f(e, t) {
  var n = t.length < 0 ? 0 : p(t.length) | 0;
  e = s(e, n);
  for (var r = 0; r < n; r += 1) {
    e[r] = t[r] & 255;
  }
  return e;
}
function p(e) {
  if (e >= a()) {
    throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + a().toString(16) + " bytes");
  }
  return e | 0;
}
function h(e, t) {
  if (l.isBuffer(e)) {
    return e.length;
  }
  if (typeof ArrayBuffer != "undefined" && typeof ArrayBuffer.isView == "function" && (ArrayBuffer.isView(e) || e instanceof ArrayBuffer)) {
    return e.byteLength;
  }
  if (typeof e != "string") {
    e = "" + e;
  }
  var n = e.length;
  if (n === 0) {
    return 0;
  }
  var r = false;
  while (true) {
    switch (t) {
      case "ascii":
      case "latin1":
      case "binary":
        return n;
      case "utf8":
      case "utf-8":
      case undefined:
        return U(e).length;
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return n * 2;
      case "hex":
        return n >>> 1;
      case "base64":
        return z(e).length;
      default:
        if (r) {
          return U(e).length;
        }
        t = ("" + t).toLowerCase();
        r = true;
    }
  }
}
function m(e, t, n) {
  var r = e[t];
  e[t] = e[n];
  e[n] = r;
}
function y(e, t, n, r, i) {
  if (e.length === 0) {
    return -1;
  }
  if (typeof n == "string") {
    r = n;
    n = 0;
  } else if (n > 2147483647) {
    n = 2147483647;
  } else if (n < -2147483648) {
    n = -2147483648;
  }
  n = +n;
  if (isNaN(n)) {
    n = i ? 0 : e.length - 1;
  }
  if (n < 0) {
    n = e.length + n;
  }
  if (n >= e.length) {
    if (i) {
      return -1;
    }
    n = e.length - 1;
  } else if (n < 0) {
    if (!i) {
      return -1;
    }
    n = 0;
  }
  if (typeof t == "string") {
    t = l.from(t, r);
  }
  if (l.isBuffer(t)) {
    if (t.length === 0) {
      return -1;
    } else {
      return g(e, t, n, r, i);
    }
  }
  if (typeof t == "number") {
    t &= 255;
    if (l.TYPED_ARRAY_SUPPORT && typeof Uint8Array.prototype.indexOf == "function") {
      if (i) {
        return Uint8Array.prototype.indexOf.call(e, t, n);
      } else {
        return Uint8Array.prototype.lastIndexOf.call(e, t, n);
      }
    } else {
      return g(e, [t], n, r, i);
    }
  }
  throw new TypeError("val must be string, number or Buffer");
}
function g(e, t, n, r, i) {
  var o;
  var a = 1;
  var s = e.length;
  var l = t.length;
  if (r !== undefined && ((r = String(r).toLowerCase()) === "ucs2" || r === "ucs-2" || r === "utf16le" || r === "utf-16le")) {
    if (e.length < 2 || t.length < 2) {
      return -1;
    }
    a = 2;
    s /= 2;
    l /= 2;
    n /= 2;
  }
  function u(e, t) {
    if (a === 1) {
      return e[t];
    } else {
      return e.readUInt16BE(t * a);
    }
  }
  if (i) {
    var c = -1;
    for (o = n; o < s; o++) {
      if (u(e, o) === u(t, c === -1 ? 0 : o - c)) {
        if (c === -1) {
          c = o;
        }
        if (o - c + 1 === l) {
          return c * a;
        }
      } else {
        if (c !== -1) {
          o -= o - c;
        }
        c = -1;
      }
    }
  } else {
    if (n + l > s) {
      n = s - l;
    }
    o = n;
    for (; o >= 0; o--) {
      var d = true;
      for (var f = 0; f < l; f++) {
        if (u(e, o + f) !== u(t, f)) {
          d = false;
          break;
        }
      }
      if (d) {
        return o;
      }
    }
  }
  return -1;
}
function v(e, t, n, r) {
  n = Number(n) || 0;
  var i = e.length - n;
  if (r) {
    if ((r = Number(r)) > i) {
      r = i;
    }
  } else {
    r = i;
  }
  var o = t.length;
  if (o % 2 != 0) {
    throw new TypeError("Invalid hex string");
  }
  if (r > o / 2) {
    r = o / 2;
  }
  for (var a = 0; a < r; ++a) {
    var s = parseInt(t.substr(a * 2, 2), 16);
    if (isNaN(s)) {
      return a;
    }
    e[n + a] = s;
  }
  return a;
}
function b(e, t, n, r) {
  return H(U(t, e.length - n), e, n, r);
}
function _(e, t, n, r) {
  return H(function (e) {
    var t = [];
    for (var n = 0; n < e.length; ++n) {
      t.push(e.charCodeAt(n) & 255);
    }
    return t;
  }(t), e, n, r);
}
function w(e, t, n, r) {
  return _(e, t, n, r);
}
function x(e, t, n, r) {
  return H(z(t), e, n, r);
}
function E(e, t, n, r) {
  return H(function (e, t) {
    var n;
    var r;
    var i;
    var o = [];
    for (var a = 0; a < e.length && !((t -= 2) < 0); ++a) {
      n = e.charCodeAt(a);
      r = n >> 8;
      i = n % 256;
      o.push(i);
      o.push(r);
    }
    return o;
  }(t, e.length - n), e, n, r);
}
function S(e, t, n) {
  if (t === 0 && n === e.length) {
    return r.fromByteArray(e);
  } else {
    return r.fromByteArray(e.slice(t, n));
  }
}
function T(e, t, n) {
  n = Math.min(e.length, n);
  var r = [];
  for (var i = t; i < n;) {
    var o;
    var a;
    var s;
    var l;
    var u = e[i];
    var c = null;
    var d = u > 239 ? 4 : u > 223 ? 3 : u > 191 ? 2 : 1;
    if (i + d <= n) {
      switch (d) {
        case 1:
          if (u < 128) {
            c = u;
          }
          break;
        case 2:
          if (((o = e[i + 1]) & 192) == 128 && (l = (u & 31) << 6 | o & 63) > 127) {
            c = l;
          }
          break;
        case 3:
          o = e[i + 1];
          a = e[i + 2];
          if ((o & 192) == 128 && (a & 192) == 128 && (l = (u & 15) << 12 | (o & 63) << 6 | a & 63) > 2047 && (l < 55296 || l > 57343)) {
            c = l;
          }
          break;
        case 4:
          o = e[i + 1];
          a = e[i + 2];
          s = e[i + 3];
          if ((o & 192) == 128 && (a & 192) == 128 && (s & 192) == 128 && (l = (u & 15) << 18 | (o & 63) << 12 | (a & 63) << 6 | s & 63) > 65535 && l < 1114112) {
            c = l;
          }
      }
    }
    if (c === null) {
      c = 65533;
      d = 1;
    } else if (c > 65535) {
      c -= 65536;
      r.push(c >>> 10 & 1023 | 55296);
      c = c & 1023 | 56320;
    }
    r.push(c);
    i += d;
  }
  return function (e) {
    var t = e.length;
    if (t <= k) {
      return String.fromCharCode.apply(String, e);
    }
    var n = "";
    var r = 0;
    while (r < t) {
      n += String.fromCharCode.apply(String, e.slice(r, r += k));
    }
    return n;
  }(r);
}
exports.Buffer = l;
exports.SlowBuffer = function (e) {
  if (+e != e) {
    e = 0;
  }
  return l.alloc(+e);
};
exports.INSPECT_MAX_BYTES = 50;
l.TYPED_ARRAY_SUPPORT = e.TYPED_ARRAY_SUPPORT !== undefined ? e.TYPED_ARRAY_SUPPORT : function () {
  try {
    var e = new Uint8Array(1);
    e.__proto__ = {
      __proto__: Uint8Array.prototype,
      foo: function () {
        return 42;
      }
    };
    return e.foo() === 42 && typeof e.subarray == "function" && e.subarray(1, 1).byteLength === 0;
  } catch (e) {
    return false;
  }
}();
exports.kMaxLength = a();
l.poolSize = 8192;
l._augment = function (e) {
  e.__proto__ = l.prototype;
  return e;
};
l.from = function (e, t, n) {
  return u(null, e, t, n);
};
if (l.TYPED_ARRAY_SUPPORT) {
  l.prototype.__proto__ = Uint8Array.prototype;
  l.__proto__ = Uint8Array;
  if (typeof Symbol != "undefined" && Symbol.species && l[Symbol.species] === l) {
    Object.defineProperty(l, Symbol.species, {
      value: null,
      configurable: true
    });
  }
}
l.alloc = function (e, t, n) {
  return function (e, t, n, r) {
    c(t);
    if (t <= 0) {
      return s(e, t);
    } else if (n !== undefined) {
      if (typeof r == "string") {
        return s(e, t).fill(n, r);
      } else {
        return s(e, t).fill(n);
      }
    } else {
      return s(e, t);
    }
  }(null, e, t, n);
};
l.allocUnsafe = function (e) {
  return d(null, e);
};
l.allocUnsafeSlow = function (e) {
  return d(null, e);
};
l.isBuffer = function (e) {
  return e != null && !!e._isBuffer;
};
l.compare = function (e, t) {
  if (!l.isBuffer(e) || !l.isBuffer(t)) {
    throw new TypeError("Arguments must be Buffers");
  }
  if (e === t) {
    return 0;
  }
  var n = e.length;
  var r = t.length;
  for (var i = 0, o = Math.min(n, r); i < o; ++i) {
    if (e[i] !== t[i]) {
      n = e[i];
      r = t[i];
      break;
    }
  }
  if (n < r) {
    return -1;
  } else if (r < n) {
    return 1;
  } else {
    return 0;
  }
};
l.isEncoding = function (e) {
  switch (String(e).toLowerCase()) {
    case "hex":
    case "utf8":
    case "utf-8":
    case "ascii":
    case "latin1":
    case "binary":
    case "base64":
    case "ucs2":
    case "ucs-2":
    case "utf16le":
    case "utf-16le":
      return true;
    default:
      return false;
  }
};
l.concat = function (e, t) {
  if (!o(e)) {
    throw new TypeError("\"list\" argument must be an Array of Buffers");
  }
  if (e.length === 0) {
    return l.alloc(0);
  }
  var n;
  if (t === undefined) {
    t = 0;
    n = 0;
    for (; n < e.length; ++n) {
      t += e[n].length;
    }
  }
  var r = l.allocUnsafe(t);
  var i = 0;
  for (n = 0; n < e.length; ++n) {
    var a = e[n];
    if (!l.isBuffer(a)) {
      throw new TypeError("\"list\" argument must be an Array of Buffers");
    }
    a.copy(r, i);
    i += a.length;
  }
  return r;
};
l.byteLength = h;
l.prototype._isBuffer = true;
l.prototype.swap16 = function () {
  var e = this.length;
  if (e % 2 != 0) {
    throw new RangeError("Buffer size must be a multiple of 16-bits");
  }
  for (var t = 0; t < e; t += 2) {
    m(this, t, t + 1);
  }
  return this;
};
l.prototype.swap32 = function () {
  var e = this.length;
  if (e % 4 != 0) {
    throw new RangeError("Buffer size must be a multiple of 32-bits");
  }
  for (var t = 0; t < e; t += 4) {
    m(this, t, t + 3);
    m(this, t + 1, t + 2);
  }
  return this;
};
l.prototype.swap64 = function () {
  var e = this.length;
  if (e % 8 != 0) {
    throw new RangeError("Buffer size must be a multiple of 64-bits");
  }
  for (var t = 0; t < e; t += 8) {
    m(this, t, t + 7);
    m(this, t + 1, t + 6);
    m(this, t + 2, t + 5);
    m(this, t + 3, t + 4);
  }
  return this;
};
l.prototype.toString = function () {
  var e = this.length | 0;
  if (e === 0) {
    return "";
  } else if (arguments.length === 0) {
    return T(this, 0, e);
  } else {
    return function (e, t, n) {
      var r = false;
      if (t === undefined || t < 0) {
        t = 0;
      }
      if (t > this.length) {
        return "";
      }
      if (n === undefined || n > this.length) {
        n = this.length;
      }
      if (n <= 0) {
        return "";
      }
      if ((n >>>= 0) <= (t >>>= 0)) {
        return "";
      }
      for (e ||= "utf8";;) {
        switch (e) {
          case "hex":
            return C(this, t, n);
          case "utf8":
          case "utf-8":
            return T(this, t, n);
          case "ascii":
            return O(this, t, n);
          case "latin1":
          case "binary":
            return P(this, t, n);
          case "base64":
            return S(this, t, n);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return I(this, t, n);
          default:
            if (r) {
              throw new TypeError("Unknown encoding: " + e);
            }
            e = (e + "").toLowerCase();
            r = true;
        }
      }
    }.apply(this, arguments);
  }
};
l.prototype.equals = function (e) {
  if (!l.isBuffer(e)) {
    throw new TypeError("Argument must be a Buffer");
  }
  return this === e || l.compare(this, e) === 0;
};
l.prototype.inspect = function () {
  var e = "";
  var n = exports.INSPECT_MAX_BYTES;
  if (this.length > 0) {
    e = this.toString("hex", 0, n).match(/.{2}/g).join(" ");
    if (this.length > n) {
      e += " ... ";
    }
  }
  return "<Buffer " + e + ">";
};
l.prototype.compare = function (e, t, n, r, i) {
  if (!l.isBuffer(e)) {
    throw new TypeError("Argument must be a Buffer");
  }
  if (t === undefined) {
    t = 0;
  }
  if (n === undefined) {
    n = e ? e.length : 0;
  }
  if (r === undefined) {
    r = 0;
  }
  if (i === undefined) {
    i = this.length;
  }
  if (t < 0 || n > e.length || r < 0 || i > this.length) {
    throw new RangeError("out of range index");
  }
  if (r >= i && t >= n) {
    return 0;
  }
  if (r >= i) {
    return -1;
  }
  if (t >= n) {
    return 1;
  }
  t >>>= 0;
  n >>>= 0;
  r >>>= 0;
  i >>>= 0;
  if (this === e) {
    return 0;
  }
  var o = i - r;
  var a = n - t;
  for (var s = Math.min(o, a), u = this.slice(r, i), c = e.slice(t, n), d = 0; d < s; ++d) {
    if (u[d] !== c[d]) {
      o = u[d];
      a = c[d];
      break;
    }
  }
  if (o < a) {
    return -1;
  } else if (a < o) {
    return 1;
  } else {
    return 0;
  }
};
l.prototype.includes = function (e, t, n) {
  return this.indexOf(e, t, n) !== -1;
};
l.prototype.indexOf = function (e, t, n) {
  return y(this, e, t, n, true);
};
l.prototype.lastIndexOf = function (e, t, n) {
  return y(this, e, t, n, false);
};
l.prototype.write = function (e, t, n, r) {
  if (t === undefined) {
    r = "utf8";
    n = this.length;
    t = 0;
  } else if (n === undefined && typeof t == "string") {
    r = t;
    n = this.length;
    t = 0;
  } else {
    if (!isFinite(t)) {
      throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
    }
    t |= 0;
    if (isFinite(n)) {
      n |= 0;
      if (r === undefined) {
        r = "utf8";
      }
    } else {
      r = n;
      n = undefined;
    }
  }
  var i = this.length - t;
  if (n === undefined || n > i) {
    n = i;
  }
  if (e.length > 0 && (n < 0 || t < 0) || t > this.length) {
    throw new RangeError("Attempt to write outside buffer bounds");
  }
  r ||= "utf8";
  var o = false;
  while (true) {
    switch (r) {
      case "hex":
        return v(this, e, t, n);
      case "utf8":
      case "utf-8":
        return b(this, e, t, n);
      case "ascii":
        return _(this, e, t, n);
      case "latin1":
      case "binary":
        return w(this, e, t, n);
      case "base64":
        return x(this, e, t, n);
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return E(this, e, t, n);
      default:
        if (o) {
          throw new TypeError("Unknown encoding: " + r);
        }
        r = ("" + r).toLowerCase();
        o = true;
    }
  }
};
l.prototype.toJSON = function () {
  return {
    type: "Buffer",
    data: Array.prototype.slice.call(this._arr || this, 0)
  };
};
var k = 4096;
function O(e, t, n) {
  var r = "";
  n = Math.min(e.length, n);
  for (var i = t; i < n; ++i) {
    r += String.fromCharCode(e[i] & 127);
  }
  return r;
}
function P(e, t, n) {
  var r = "";
  n = Math.min(e.length, n);
  for (var i = t; i < n; ++i) {
    r += String.fromCharCode(e[i]);
  }
  return r;
}
function C(e, t, n) {
  var r = e.length;
  if (!t || t < 0) {
    t = 0;
  }
  if (!n || n < 0 || n > r) {
    n = r;
  }
  var i = "";
  for (var o = t; o < n; ++o) {
    i += B(e[o]);
  }
  return i;
}
function I(e, t, n) {
  for (var r = e.slice(t, n), i = "", o = 0; o < r.length; o += 2) {
    i += String.fromCharCode(r[o] + r[o + 1] * 256);
  }
  return i;
}
function M(e, t, n) {
  if (e % 1 != 0 || e < 0) {
    throw new RangeError("offset is not uint");
  }
  if (e + t > n) {
    throw new RangeError("Trying to access beyond buffer length");
  }
}
function L(e, t, n, r, i, o) {
  if (!l.isBuffer(e)) {
    throw new TypeError("\"buffer\" argument must be a Buffer instance");
  }
  if (t > i || t < o) {
    throw new RangeError("\"value\" argument is out of bounds");
  }
  if (n + r > e.length) {
    throw new RangeError("Index out of range");
  }
}
function R(e, t, n, r) {
  if (t < 0) {
    t = 65535 + t + 1;
  }
  for (var i = 0, o = Math.min(e.length - n, 2); i < o; ++i) {
    e[n + i] = (t & 255 << (r ? i : 1 - i) * 8) >>> (r ? i : 1 - i) * 8;
  }
}
function A(e, t, n, r) {
  if (t < 0) {
    t = 4294967295 + t + 1;
  }
  for (var i = 0, o = Math.min(e.length - n, 4); i < o; ++i) {
    e[n + i] = t >>> (r ? i : 3 - i) * 8 & 255;
  }
}
function D(e, t, n, r, i, o) {
  if (n + r > e.length) {
    throw new RangeError("Index out of range");
  }
  if (n < 0) {
    throw new RangeError("Index out of range");
  }
}
function N(e, t, n, r, o) {
  if (!o) {
    D(e, 0, n, 4);
  }
  i.write(e, t, n, r, 23, 4);
  return n + 4;
}
function j(e, t, n, r, o) {
  if (!o) {
    D(e, 0, n, 8);
  }
  i.write(e, t, n, r, 52, 8);
  return n + 8;
}
l.prototype.slice = function (e, t) {
  var n;
  var r = this.length;
  e = ~~e;
  t = t === undefined ? r : ~~t;
  if (e < 0) {
    if ((e += r) < 0) {
      e = 0;
    }
  } else if (e > r) {
    e = r;
  }
  if (t < 0) {
    if ((t += r) < 0) {
      t = 0;
    }
  } else if (t > r) {
    t = r;
  }
  if (t < e) {
    t = e;
  }
  if (l.TYPED_ARRAY_SUPPORT) {
    (n = this.subarray(e, t)).__proto__ = l.prototype;
  } else {
    var i = t - e;
    n = new l(i, undefined);
    for (var o = 0; o < i; ++o) {
      n[o] = this[o + e];
    }
  }
  return n;
};
l.prototype.readUIntLE = function (e, t, n) {
  e |= 0;
  t |= 0;
  if (!n) {
    M(e, t, this.length);
  }
  var r = this[e];
  for (var i = 1, o = 0; ++o < t && (i *= 256);) {
    r += this[e + o] * i;
  }
  return r;
};
l.prototype.readUIntBE = function (e, t, n) {
  e |= 0;
  t |= 0;
  if (!n) {
    M(e, t, this.length);
  }
  var r = this[e + --t];
  for (var i = 1; t > 0 && (i *= 256);) {
    r += this[e + --t] * i;
  }
  return r;
};
l.prototype.readUInt8 = function (e, t) {
  if (!t) {
    M(e, 1, this.length);
  }
  return this[e];
};
l.prototype.readUInt16LE = function (e, t) {
  if (!t) {
    M(e, 2, this.length);
  }
  return this[e] | this[e + 1] << 8;
};
l.prototype.readUInt16BE = function (e, t) {
  if (!t) {
    M(e, 2, this.length);
  }
  return this[e] << 8 | this[e + 1];
};
l.prototype.readUInt32LE = function (e, t) {
  if (!t) {
    M(e, 4, this.length);
  }
  return (this[e] | this[e + 1] << 8 | this[e + 2] << 16) + this[e + 3] * 16777216;
};
l.prototype.readUInt32BE = function (e, t) {
  if (!t) {
    M(e, 4, this.length);
  }
  return this[e] * 16777216 + (this[e + 1] << 16 | this[e + 2] << 8 | this[e + 3]);
};
l.prototype.readIntLE = function (e, t, n) {
  e |= 0;
  t |= 0;
  if (!n) {
    M(e, t, this.length);
  }
  var r = this[e];
  for (var i = 1, o = 0; ++o < t && (i *= 256);) {
    r += this[e + o] * i;
  }
  if (r >= (i *= 128)) {
    r -= Math.pow(2, t * 8);
  }
  return r;
};
l.prototype.readIntBE = function (e, t, n) {
  e |= 0;
  t |= 0;
  if (!n) {
    M(e, t, this.length);
  }
  for (var r = t, i = 1, o = this[e + --r]; r > 0 && (i *= 256);) {
    o += this[e + --r] * i;
  }
  if (o >= (i *= 128)) {
    o -= Math.pow(2, t * 8);
  }
  return o;
};
l.prototype.readInt8 = function (e, t) {
  if (!t) {
    M(e, 1, this.length);
  }
  if (this[e] & 128) {
    return (255 - this[e] + 1) * -1;
  } else {
    return this[e];
  }
};
l.prototype.readInt16LE = function (e, t) {
  if (!t) {
    M(e, 2, this.length);
  }
  var n = this[e] | this[e + 1] << 8;
  if (n & 32768) {
    return n | -65536;
  } else {
    return n;
  }
};
l.prototype.readInt16BE = function (e, t) {
  if (!t) {
    M(e, 2, this.length);
  }
  var n = this[e + 1] | this[e] << 8;
  if (n & 32768) {
    return n | -65536;
  } else {
    return n;
  }
};
l.prototype.readInt32LE = function (e, t) {
  if (!t) {
    M(e, 4, this.length);
  }
  return this[e] | this[e + 1] << 8 | this[e + 2] << 16 | this[e + 3] << 24;
};
l.prototype.readInt32BE = function (e, t) {
  if (!t) {
    M(e, 4, this.length);
  }
  return this[e] << 24 | this[e + 1] << 16 | this[e + 2] << 8 | this[e + 3];
};
l.prototype.readFloatLE = function (e, t) {
  if (!t) {
    M(e, 4, this.length);
  }
  return i.read(this, e, true, 23, 4);
};
l.prototype.readFloatBE = function (e, t) {
  if (!t) {
    M(e, 4, this.length);
  }
  return i.read(this, e, false, 23, 4);
};
l.prototype.readDoubleLE = function (e, t) {
  if (!t) {
    M(e, 8, this.length);
  }
  return i.read(this, e, true, 52, 8);
};
l.prototype.readDoubleBE = function (e, t) {
  if (!t) {
    M(e, 8, this.length);
  }
  return i.read(this, e, false, 52, 8);
};
l.prototype.writeUIntLE = function (e, t, n, r) {
  if (!(e = +e, t |= 0, n |= 0, r)) {
    L(this, e, t, n, Math.pow(2, n * 8) - 1, 0);
  }
  var i = 1;
  var o = 0;
  for (this[t] = e & 255; ++o < n && (i *= 256);) {
    this[t + o] = e / i & 255;
  }
  return t + n;
};
l.prototype.writeUIntBE = function (e, t, n, r) {
  if (!(e = +e, t |= 0, n |= 0, r)) {
    L(this, e, t, n, Math.pow(2, n * 8) - 1, 0);
  }
  var i = n - 1;
  var o = 1;
  for (this[t + i] = e & 255; --i >= 0 && (o *= 256);) {
    this[t + i] = e / o & 255;
  }
  return t + n;
};
l.prototype.writeUInt8 = function (e, t, n) {
  e = +e;
  t |= 0;
  if (!n) {
    L(this, e, t, 1, 255, 0);
  }
  if (!l.TYPED_ARRAY_SUPPORT) {
    e = Math.floor(e);
  }
  this[t] = e & 255;
  return t + 1;
};
l.prototype.writeUInt16LE = function (e, t, n) {
  e = +e;
  t |= 0;
  if (!n) {
    L(this, e, t, 2, 65535, 0);
  }
  if (l.TYPED_ARRAY_SUPPORT) {
    this[t] = e & 255;
    this[t + 1] = e >>> 8;
  } else {
    R(this, e, t, true);
  }
  return t + 2;
};
l.prototype.writeUInt16BE = function (e, t, n) {
  e = +e;
  t |= 0;
  if (!n) {
    L(this, e, t, 2, 65535, 0);
  }
  if (l.TYPED_ARRAY_SUPPORT) {
    this[t] = e >>> 8;
    this[t + 1] = e & 255;
  } else {
    R(this, e, t, false);
  }
  return t + 2;
};
l.prototype.writeUInt32LE = function (e, t, n) {
  e = +e;
  t |= 0;
  if (!n) {
    L(this, e, t, 4, 4294967295, 0);
  }
  if (l.TYPED_ARRAY_SUPPORT) {
    this[t + 3] = e >>> 24;
    this[t + 2] = e >>> 16;
    this[t + 1] = e >>> 8;
    this[t] = e & 255;
  } else {
    A(this, e, t, true);
  }
  return t + 4;
};
l.prototype.writeUInt32BE = function (e, t, n) {
  e = +e;
  t |= 0;
  if (!n) {
    L(this, e, t, 4, 4294967295, 0);
  }
  if (l.TYPED_ARRAY_SUPPORT) {
    this[t] = e >>> 24;
    this[t + 1] = e >>> 16;
    this[t + 2] = e >>> 8;
    this[t + 3] = e & 255;
  } else {
    A(this, e, t, false);
  }
  return t + 4;
};
l.prototype.writeIntLE = function (e, t, n, r) {
  e = +e;
  t |= 0;
  if (!r) {
    var i = Math.pow(2, n * 8 - 1);
    L(this, e, t, n, i - 1, -i);
  }
  var o = 0;
  var a = 1;
  var s = 0;
  for (this[t] = e & 255; ++o < n && (a *= 256);) {
    if (e < 0 && s === 0 && this[t + o - 1] !== 0) {
      s = 1;
    }
    this[t + o] = (e / a >> 0) - s & 255;
  }
  return t + n;
};
l.prototype.writeIntBE = function (e, t, n, r) {
  e = +e;
  t |= 0;
  if (!r) {
    var i = Math.pow(2, n * 8 - 1);
    L(this, e, t, n, i - 1, -i);
  }
  var o = n - 1;
  var a = 1;
  var s = 0;
  for (this[t + o] = e & 255; --o >= 0 && (a *= 256);) {
    if (e < 0 && s === 0 && this[t + o + 1] !== 0) {
      s = 1;
    }
    this[t + o] = (e / a >> 0) - s & 255;
  }
  return t + n;
};
l.prototype.writeInt8 = function (e, t, n) {
  e = +e;
  t |= 0;
  if (!n) {
    L(this, e, t, 1, 127, -128);
  }
  if (!l.TYPED_ARRAY_SUPPORT) {
    e = Math.floor(e);
  }
  if (e < 0) {
    e = 255 + e + 1;
  }
  this[t] = e & 255;
  return t + 1;
};
l.prototype.writeInt16LE = function (e, t, n) {
  e = +e;
  t |= 0;
  if (!n) {
    L(this, e, t, 2, 32767, -32768);
  }
  if (l.TYPED_ARRAY_SUPPORT) {
    this[t] = e & 255;
    this[t + 1] = e >>> 8;
  } else {
    R(this, e, t, true);
  }
  return t + 2;
};
l.prototype.writeInt16BE = function (e, t, n) {
  e = +e;
  t |= 0;
  if (!n) {
    L(this, e, t, 2, 32767, -32768);
  }
  if (l.TYPED_ARRAY_SUPPORT) {
    this[t] = e >>> 8;
    this[t + 1] = e & 255;
  } else {
    R(this, e, t, false);
  }
  return t + 2;
};
l.prototype.writeInt32LE = function (e, t, n) {
  e = +e;
  t |= 0;
  if (!n) {
    L(this, e, t, 4, 2147483647, -2147483648);
  }
  if (l.TYPED_ARRAY_SUPPORT) {
    this[t] = e & 255;
    this[t + 1] = e >>> 8;
    this[t + 2] = e >>> 16;
    this[t + 3] = e >>> 24;
  } else {
    A(this, e, t, true);
  }
  return t + 4;
};
l.prototype.writeInt32BE = function (e, t, n) {
  e = +e;
  t |= 0;
  if (!n) {
    L(this, e, t, 4, 2147483647, -2147483648);
  }
  if (e < 0) {
    e = 4294967295 + e + 1;
  }
  if (l.TYPED_ARRAY_SUPPORT) {
    this[t] = e >>> 24;
    this[t + 1] = e >>> 16;
    this[t + 2] = e >>> 8;
    this[t + 3] = e & 255;
  } else {
    A(this, e, t, false);
  }
  return t + 4;
};
l.prototype.writeFloatLE = function (e, t, n) {
  return N(this, e, t, true, n);
};
l.prototype.writeFloatBE = function (e, t, n) {
  return N(this, e, t, false, n);
};
l.prototype.writeDoubleLE = function (e, t, n) {
  return j(this, e, t, true, n);
};
l.prototype.writeDoubleBE = function (e, t, n) {
  return j(this, e, t, false, n);
};
l.prototype.copy = function (e, t, n, r) {
  n ||= 0;
  if (!r && r !== 0) {
    r = this.length;
  }
  if (t >= e.length) {
    t = e.length;
  }
  t ||= 0;
  if (r > 0 && r < n) {
    r = n;
  }
  if (r === n) {
    return 0;
  }
  if (e.length === 0 || this.length === 0) {
    return 0;
  }
  if (t < 0) {
    throw new RangeError("targetStart out of bounds");
  }
  if (n < 0 || n >= this.length) {
    throw new RangeError("sourceStart out of bounds");
  }
  if (r < 0) {
    throw new RangeError("sourceEnd out of bounds");
  }
  if (r > this.length) {
    r = this.length;
  }
  if (e.length - t < r - n) {
    r = e.length - t + n;
  }
  var i;
  var o = r - n;
  if (this === e && n < t && t < r) {
    for (i = o - 1; i >= 0; --i) {
      e[i + t] = this[i + n];
    }
  } else if (o < 1000 || !l.TYPED_ARRAY_SUPPORT) {
    for (i = 0; i < o; ++i) {
      e[i + t] = this[i + n];
    }
  } else {
    Uint8Array.prototype.set.call(e, this.subarray(n, n + o), t);
  }
  return o;
};
l.prototype.fill = function (e, t, n, r) {
  if (typeof e == "string") {
    if (typeof t == "string") {
      r = t;
      t = 0;
      n = this.length;
    } else if (typeof n == "string") {
      r = n;
      n = this.length;
    }
    if (e.length === 1) {
      var i = e.charCodeAt(0);
      if (i < 256) {
        e = i;
      }
    }
    if (r !== undefined && typeof r != "string") {
      throw new TypeError("encoding must be a string");
    }
    if (typeof r == "string" && !l.isEncoding(r)) {
      throw new TypeError("Unknown encoding: " + r);
    }
  } else if (typeof e == "number") {
    e &= 255;
  }
  if (t < 0 || this.length < t || this.length < n) {
    throw new RangeError("Out of range index");
  }
  if (n <= t) {
    return this;
  }
  var o;
  t >>>= 0;
  n = n === undefined ? this.length : n >>> 0;
  e ||= 0;
  if (typeof e == "number") {
    for (o = t; o < n; ++o) {
      this[o] = e;
    }
  } else {
    var a = l.isBuffer(e) ? e : U(new l(e, r).toString());
    var s = a.length;
    for (o = 0; o < n - t; ++o) {
      this[o + t] = a[o % s];
    }
  }
  return this;
};
var F = /[^+\/0-9A-Za-z-_]/g;
function B(e) {
  if (e < 16) {
    return "0" + e.toString(16);
  } else {
    return e.toString(16);
  }
}
function U(e, t) {
  var n;
  t = t || Infinity;
  for (var r = e.length, i = null, o = [], a = 0; a < r; ++a) {
    if ((n = e.charCodeAt(a)) > 55295 && n < 57344) {
      if (!i) {
        if (n > 56319) {
          if ((t -= 3) > -1) {
            o.push(239, 191, 189);
          }
          continue;
        }
        if (a + 1 === r) {
          if ((t -= 3) > -1) {
            o.push(239, 191, 189);
          }
          continue;
        }
        i = n;
        continue;
      }
      if (n < 56320) {
        if ((t -= 3) > -1) {
          o.push(239, 191, 189);
        }
        i = n;
        continue;
      }
      n = 65536 + (i - 55296 << 10 | n - 56320);
    } else if (i && (t -= 3) > -1) {
      o.push(239, 191, 189);
    }
    i = null;
    if (n < 128) {
      if ((t -= 1) < 0) {
        break;
      }
      o.push(n);
    } else if (n < 2048) {
      if ((t -= 2) < 0) {
        break;
      }
      o.push(n >> 6 | 192, n & 63 | 128);
    } else if (n < 65536) {
      if ((t -= 3) < 0) {
        break;
      }
      o.push(n >> 12 | 224, n >> 6 & 63 | 128, n & 63 | 128);
    } else {
      if (!(n < 1114112)) {
        throw new Error("Invalid code point");
      }
      if ((t -= 4) < 0) {
        break;
      }
      o.push(n >> 18 | 240, n >> 12 & 63 | 128, n >> 6 & 63 | 128, n & 63 | 128);
    }
  }
  return o;
}
function z(e) {
  return r.toByteArray(function (e) {
    if ((e = function (e) {
      if (e.trim) {
        return e.trim();
      } else {
        return e.replace(/^\s+|\s+$/g, "");
      }
    }(e).replace(F, "")).length < 2) {
      return "";
    }
    while (e.length % 4 != 0) {
      e += "=";
    }
    return e;
  }(e));
}
function H(e, t, n, r) {
  for (var i = 0; i < r && !(i + n >= t.length) && !(i >= e.length); ++i) {
    t[i + n] = e[i];
  }
  return i;
}