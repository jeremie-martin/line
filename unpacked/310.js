var r;
var i = function () {
  var e = String.fromCharCode;
  var t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  var n = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
  var r = {};
  function i(e, t) {
    if (!r[e]) {
      r[e] = {};
      for (var n = 0; n < e.length; n++) {
        r[e][e.charAt(n)] = n;
      }
    }
    return r[e][t];
  }
  var o = {
    compressToBase64: function (e) {
      if (e == null) {
        return "";
      }
      var n = o._compress(e, 6, function (e) {
        return t.charAt(e);
      });
      switch (n.length % 4) {
        default:
        case 0:
          return n;
        case 1:
          return n + "===";
        case 2:
          return n + "==";
        case 3:
          return n + "=";
      }
    },
    decompressFromBase64: function (e) {
      if (e == null) {
        return "";
      } else if (e == "") {
        return null;
      } else {
        return o._decompress(e.length, 32, function (n) {
          return i(t, e.charAt(n));
        });
      }
    },
    compressToUTF16: function (t) {
      if (t == null) {
        return "";
      } else {
        return o._compress(t, 15, function (t) {
          return e(t + 32);
        }) + " ";
      }
    },
    decompressFromUTF16: function (e) {
      if (e == null) {
        return "";
      } else if (e == "") {
        return null;
      } else {
        return o._decompress(e.length, 16384, function (t) {
          return e.charCodeAt(t) - 32;
        });
      }
    },
    compressToUint8Array: function (e) {
      var t = o.compress(e);
      var n = new Uint8Array(t.length * 2);
      for (var r = 0, i = t.length; r < i; r++) {
        var a = t.charCodeAt(r);
        n[r * 2] = a >>> 8;
        n[r * 2 + 1] = a % 256;
      }
      return n;
    },
    decompressFromUint8Array: function (t) {
      if (t === null || t === undefined) {
        return o.decompress(t);
      }
      var n = new Array(t.length / 2);
      for (var r = 0, i = n.length; r < i; r++) {
        n[r] = t[r * 2] * 256 + t[r * 2 + 1];
      }
      var a = [];
      n.forEach(function (t) {
        a.push(e(t));
      });
      return o.decompress(a.join(""));
    },
    compressToEncodedURIComponent: function (e) {
      if (e == null) {
        return "";
      } else {
        return o._compress(e, 6, function (e) {
          return n.charAt(e);
        });
      }
    },
    decompressFromEncodedURIComponent: function (e) {
      if (e == null) {
        return "";
      } else if (e == "") {
        return null;
      } else {
        e = e.replace(/ /g, "+");
        return o._decompress(e.length, 32, function (t) {
          return i(n, e.charAt(t));
        });
      }
    },
    compress: function (t) {
      return o._compress(t, 16, function (t) {
        return e(t);
      });
    },
    _compress: function (e, t, n) {
      if (e == null) {
        return "";
      }
      var r;
      var i;
      var o;
      var a = {};
      var s = {};
      var l = "";
      var u = "";
      var c = "";
      var d = 2;
      var f = 3;
      var p = 2;
      var h = [];
      var m = 0;
      var y = 0;
      for (o = 0; o < e.length; o += 1) {
        l = e.charAt(o);
        if (!Object.prototype.hasOwnProperty.call(a, l)) {
          a[l] = f++;
          s[l] = true;
        }
        u = c + l;
        if (Object.prototype.hasOwnProperty.call(a, u)) {
          c = u;
        } else {
          if (Object.prototype.hasOwnProperty.call(s, c)) {
            if (c.charCodeAt(0) < 256) {
              for (r = 0; r < p; r++) {
                m <<= 1;
                if (y == t - 1) {
                  y = 0;
                  h.push(n(m));
                  m = 0;
                } else {
                  y++;
                }
              }
              i = c.charCodeAt(0);
              r = 0;
              for (; r < 8; r++) {
                m = m << 1 | i & 1;
                if (y == t - 1) {
                  y = 0;
                  h.push(n(m));
                  m = 0;
                } else {
                  y++;
                }
                i >>= 1;
              }
            } else {
              i = 1;
              r = 0;
              for (; r < p; r++) {
                m = m << 1 | i;
                if (y == t - 1) {
                  y = 0;
                  h.push(n(m));
                  m = 0;
                } else {
                  y++;
                }
                i = 0;
              }
              i = c.charCodeAt(0);
              r = 0;
              for (; r < 16; r++) {
                m = m << 1 | i & 1;
                if (y == t - 1) {
                  y = 0;
                  h.push(n(m));
                  m = 0;
                } else {
                  y++;
                }
                i >>= 1;
              }
            }
            if (--d == 0) {
              d = Math.pow(2, p);
              p++;
            }
            delete s[c];
          } else {
            i = a[c];
            r = 0;
            for (; r < p; r++) {
              m = m << 1 | i & 1;
              if (y == t - 1) {
                y = 0;
                h.push(n(m));
                m = 0;
              } else {
                y++;
              }
              i >>= 1;
            }
          }
          if (--d == 0) {
            d = Math.pow(2, p);
            p++;
          }
          a[u] = f++;
          c = String(l);
        }
      }
      if (c !== "") {
        if (Object.prototype.hasOwnProperty.call(s, c)) {
          if (c.charCodeAt(0) < 256) {
            for (r = 0; r < p; r++) {
              m <<= 1;
              if (y == t - 1) {
                y = 0;
                h.push(n(m));
                m = 0;
              } else {
                y++;
              }
            }
            i = c.charCodeAt(0);
            r = 0;
            for (; r < 8; r++) {
              m = m << 1 | i & 1;
              if (y == t - 1) {
                y = 0;
                h.push(n(m));
                m = 0;
              } else {
                y++;
              }
              i >>= 1;
            }
          } else {
            i = 1;
            r = 0;
            for (; r < p; r++) {
              m = m << 1 | i;
              if (y == t - 1) {
                y = 0;
                h.push(n(m));
                m = 0;
              } else {
                y++;
              }
              i = 0;
            }
            i = c.charCodeAt(0);
            r = 0;
            for (; r < 16; r++) {
              m = m << 1 | i & 1;
              if (y == t - 1) {
                y = 0;
                h.push(n(m));
                m = 0;
              } else {
                y++;
              }
              i >>= 1;
            }
          }
          if (--d == 0) {
            d = Math.pow(2, p);
            p++;
          }
          delete s[c];
        } else {
          i = a[c];
          r = 0;
          for (; r < p; r++) {
            m = m << 1 | i & 1;
            if (y == t - 1) {
              y = 0;
              h.push(n(m));
              m = 0;
            } else {
              y++;
            }
            i >>= 1;
          }
        }
        if (--d == 0) {
          d = Math.pow(2, p);
          p++;
        }
      }
      i = 2;
      r = 0;
      for (; r < p; r++) {
        m = m << 1 | i & 1;
        if (y == t - 1) {
          y = 0;
          h.push(n(m));
          m = 0;
        } else {
          y++;
        }
        i >>= 1;
      }
      while (true) {
        m <<= 1;
        if (y == t - 1) {
          h.push(n(m));
          break;
        }
        y++;
      }
      return h.join("");
    },
    decompress: function (e) {
      if (e == null) {
        return "";
      } else if (e == "") {
        return null;
      } else {
        return o._decompress(e.length, 32768, function (t) {
          return e.charCodeAt(t);
        });
      }
    },
    _decompress: function (t, n, r) {
      var i;
      var o;
      var a;
      var s;
      var l;
      var u;
      var c;
      var d = [];
      var f = 4;
      var p = 4;
      var h = 3;
      var m = "";
      var y = [];
      var g = {
        val: r(0),
        position: n,
        index: 1
      };
      for (i = 0; i < 3; i += 1) {
        d[i] = i;
      }
      a = 0;
      l = Math.pow(2, 2);
      u = 1;
      while (u != l) {
        s = g.val & g.position;
        g.position >>= 1;
        if (g.position == 0) {
          g.position = n;
          g.val = r(g.index++);
        }
        a |= (s > 0 ? 1 : 0) * u;
        u <<= 1;
      }
      switch (a) {
        case 0:
          a = 0;
          l = Math.pow(2, 8);
          u = 1;
          while (u != l) {
            s = g.val & g.position;
            g.position >>= 1;
            if (g.position == 0) {
              g.position = n;
              g.val = r(g.index++);
            }
            a |= (s > 0 ? 1 : 0) * u;
            u <<= 1;
          }
          c = e(a);
          break;
        case 1:
          a = 0;
          l = Math.pow(2, 16);
          u = 1;
          while (u != l) {
            s = g.val & g.position;
            g.position >>= 1;
            if (g.position == 0) {
              g.position = n;
              g.val = r(g.index++);
            }
            a |= (s > 0 ? 1 : 0) * u;
            u <<= 1;
          }
          c = e(a);
          break;
        case 2:
          return "";
      }
      d[3] = c;
      o = c;
      y.push(c);
      while (true) {
        if (g.index > t) {
          return "";
        }
        a = 0;
        l = Math.pow(2, h);
        u = 1;
        while (u != l) {
          s = g.val & g.position;
          g.position >>= 1;
          if (g.position == 0) {
            g.position = n;
            g.val = r(g.index++);
          }
          a |= (s > 0 ? 1 : 0) * u;
          u <<= 1;
        }
        switch (c = a) {
          case 0:
            a = 0;
            l = Math.pow(2, 8);
            u = 1;
            while (u != l) {
              s = g.val & g.position;
              g.position >>= 1;
              if (g.position == 0) {
                g.position = n;
                g.val = r(g.index++);
              }
              a |= (s > 0 ? 1 : 0) * u;
              u <<= 1;
            }
            d[p++] = e(a);
            c = p - 1;
            f--;
            break;
          case 1:
            a = 0;
            l = Math.pow(2, 16);
            u = 1;
            while (u != l) {
              s = g.val & g.position;
              g.position >>= 1;
              if (g.position == 0) {
                g.position = n;
                g.val = r(g.index++);
              }
              a |= (s > 0 ? 1 : 0) * u;
              u <<= 1;
            }
            d[p++] = e(a);
            c = p - 1;
            f--;
            break;
          case 2:
            return y.join("");
        }
        if (f == 0) {
          f = Math.pow(2, h);
          h++;
        }
        if (d[c]) {
          m = d[c];
        } else {
          if (c !== p) {
            return null;
          }
          m = o + o.charAt(0);
        }
        y.push(m);
        d[p++] = o + m.charAt(0);
        o = m;
        if (--f == 0) {
          f = Math.pow(2, h);
          h++;
        }
      }
    }
  };
  return o;
}();
if ((r = function () {
  return i;
}.call(exports, require, exports, module)) !== undefined) {
  module.exports = r;
}