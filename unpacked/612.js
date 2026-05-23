var r = require("./150.js");
var i = 4;
var o = 0;
var a = 1;
var s = 2;
function l(e) {
  for (var t = e.length; --t >= 0;) {
    e[t] = 0;
  }
}
var u = 0;
var c = 1;
var d = 2;
var f = 29;
var p = 256;
var h = p + 1 + f;
var m = 30;
var y = 19;
var g = h * 2 + 1;
var v = 15;
var b = 16;
var _ = 7;
var w = 256;
var x = 16;
var E = 17;
var S = 18;
var T = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
var k = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
var O = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7];
var P = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
var C = new Array((h + 2) * 2);
l(C);
var I = new Array(m * 2);
l(I);
var M = new Array(512);
l(M);
var L = new Array(256);
l(L);
var R = new Array(f);
l(R);
var A;
var D;
var N;
var j = new Array(m);
function F(e, t, n, r, i) {
  this.static_tree = e;
  this.extra_bits = t;
  this.extra_base = n;
  this.elems = r;
  this.max_length = i;
  this.has_stree = e && e.length;
}
function B(e, t) {
  this.dyn_tree = e;
  this.max_code = 0;
  this.stat_desc = t;
}
function U(e) {
  if (e < 256) {
    return M[e];
  } else {
    return M[256 + (e >>> 7)];
  }
}
function z(e, t) {
  e.pending_buf[e.pending++] = t & 255;
  e.pending_buf[e.pending++] = t >>> 8 & 255;
}
function H(e, t, n) {
  if (e.bi_valid > b - n) {
    e.bi_buf |= t << e.bi_valid & 65535;
    z(e, e.bi_buf);
    e.bi_buf = t >> b - e.bi_valid;
    e.bi_valid += n - b;
  } else {
    e.bi_buf |= t << e.bi_valid & 65535;
    e.bi_valid += n;
  }
}
function V(e, t, n) {
  H(e, n[t * 2], n[t * 2 + 1]);
}
function W(e, t) {
  var n = 0;
  do {
    n |= e & 1;
    e >>>= 1;
    n <<= 1;
  } while (--t > 0);
  return n >>> 1;
}
function q(e, t, n) {
  var r;
  var i;
  var o = new Array(v + 1);
  var a = 0;
  for (r = 1; r <= v; r++) {
    o[r] = a = a + n[r - 1] << 1;
  }
  for (i = 0; i <= t; i++) {
    var s = e[i * 2 + 1];
    if (s !== 0) {
      e[i * 2] = W(o[s]++, s);
    }
  }
}
function G(e) {
  var t;
  for (t = 0; t < h; t++) {
    e.dyn_ltree[t * 2] = 0;
  }
  for (t = 0; t < m; t++) {
    e.dyn_dtree[t * 2] = 0;
  }
  for (t = 0; t < y; t++) {
    e.bl_tree[t * 2] = 0;
  }
  e.dyn_ltree[w * 2] = 1;
  e.opt_len = e.static_len = 0;
  e.last_lit = e.matches = 0;
}
function K(e) {
  if (e.bi_valid > 8) {
    z(e, e.bi_buf);
  } else if (e.bi_valid > 0) {
    e.pending_buf[e.pending++] = e.bi_buf;
  }
  e.bi_buf = 0;
  e.bi_valid = 0;
}
function Y(e, t, n, r) {
  var i = t * 2;
  var o = n * 2;
  return e[i] < e[o] || e[i] === e[o] && r[t] <= r[n];
}
function $(e, t, n) {
  for (var r = e.heap[n], i = n << 1; i <= e.heap_len && (i < e.heap_len && Y(t, e.heap[i + 1], e.heap[i], e.depth) && i++, !Y(t, r, e.heap[i], e.depth));) {
    e.heap[n] = e.heap[i];
    n = i;
    i <<= 1;
  }
  e.heap[n] = r;
}
function X(e, t, n) {
  var r;
  var i;
  var o;
  var a;
  var s = 0;
  if (e.last_lit !== 0) {
    do {
      r = e.pending_buf[e.d_buf + s * 2] << 8 | e.pending_buf[e.d_buf + s * 2 + 1];
      i = e.pending_buf[e.l_buf + s];
      s++;
      if (r === 0) {
        V(e, i, t);
      } else {
        V(e, (o = L[i]) + p + 1, t);
        if ((a = T[o]) !== 0) {
          H(e, i -= R[o], a);
        }
        V(e, o = U(--r), n);
        if ((a = k[o]) !== 0) {
          H(e, r -= j[o], a);
        }
      }
    } while (s < e.last_lit);
  }
  V(e, w, t);
}
function Z(e, t) {
  var n;
  var r;
  var i;
  var o = t.dyn_tree;
  var a = t.stat_desc.static_tree;
  var s = t.stat_desc.has_stree;
  var l = t.stat_desc.elems;
  var u = -1;
  e.heap_len = 0;
  e.heap_max = g;
  n = 0;
  for (; n < l; n++) {
    if (o[n * 2] !== 0) {
      e.heap[++e.heap_len] = u = n;
      e.depth[n] = 0;
    } else {
      o[n * 2 + 1] = 0;
    }
  }
  while (e.heap_len < 2) {
    o[(i = e.heap[++e.heap_len] = u < 2 ? ++u : 0) * 2] = 1;
    e.depth[i] = 0;
    e.opt_len--;
    if (s) {
      e.static_len -= a[i * 2 + 1];
    }
  }
  t.max_code = u;
  n = e.heap_len >> 1;
  for (; n >= 1; n--) {
    $(e, o, n);
  }
  i = l;
  do {
    n = e.heap[1];
    e.heap[1] = e.heap[e.heap_len--];
    $(e, o, 1);
    r = e.heap[1];
    e.heap[--e.heap_max] = n;
    e.heap[--e.heap_max] = r;
    o[i * 2] = o[n * 2] + o[r * 2];
    e.depth[i] = (e.depth[n] >= e.depth[r] ? e.depth[n] : e.depth[r]) + 1;
    o[n * 2 + 1] = o[r * 2 + 1] = i;
    e.heap[1] = i++;
    $(e, o, 1);
  } while (e.heap_len >= 2);
  e.heap[--e.heap_max] = e.heap[1];
  (function (e, t) {
    var n;
    var r;
    var i;
    var o;
    var a;
    var s;
    var l = t.dyn_tree;
    var u = t.max_code;
    var c = t.stat_desc.static_tree;
    var d = t.stat_desc.has_stree;
    var f = t.stat_desc.extra_bits;
    var p = t.stat_desc.extra_base;
    var h = t.stat_desc.max_length;
    var m = 0;
    for (o = 0; o <= v; o++) {
      e.bl_count[o] = 0;
    }
    l[e.heap[e.heap_max] * 2 + 1] = 0;
    n = e.heap_max + 1;
    for (; n < g; n++) {
      if ((o = l[l[(r = e.heap[n]) * 2 + 1] * 2 + 1] + 1) > h) {
        o = h;
        m++;
      }
      l[r * 2 + 1] = o;
      if (!(r > u)) {
        e.bl_count[o]++;
        a = 0;
        if (r >= p) {
          a = f[r - p];
        }
        s = l[r * 2];
        e.opt_len += s * (o + a);
        if (d) {
          e.static_len += s * (c[r * 2 + 1] + a);
        }
      }
    }
    if (m !== 0) {
      do {
        for (o = h - 1; e.bl_count[o] === 0;) {
          o--;
        }
        e.bl_count[o]--;
        e.bl_count[o + 1] += 2;
        e.bl_count[h]--;
        m -= 2;
      } while (m > 0);
      for (o = h; o !== 0; o--) {
        for (r = e.bl_count[o]; r !== 0;) {
          if (!((i = e.heap[--n]) > u)) {
            if (l[i * 2 + 1] !== o) {
              e.opt_len += (o - l[i * 2 + 1]) * l[i * 2];
              l[i * 2 + 1] = o;
            }
            r--;
          }
        }
      }
    }
  })(e, t);
  q(o, u, e.bl_count);
}
function J(e, t, n) {
  var r;
  var i;
  var o = -1;
  var a = t[1];
  var s = 0;
  var l = 7;
  var u = 4;
  if (a === 0) {
    l = 138;
    u = 3;
  }
  t[(n + 1) * 2 + 1] = 65535;
  r = 0;
  for (; r <= n; r++) {
    i = a;
    a = t[(r + 1) * 2 + 1];
    if (!(++s < l) || i !== a) {
      if (s < u) {
        e.bl_tree[i * 2] += s;
      } else if (i !== 0) {
        if (i !== o) {
          e.bl_tree[i * 2]++;
        }
        e.bl_tree[x * 2]++;
      } else if (s <= 10) {
        e.bl_tree[E * 2]++;
      } else {
        e.bl_tree[S * 2]++;
      }
      s = 0;
      o = i;
      if (a === 0) {
        l = 138;
        u = 3;
      } else if (i === a) {
        l = 6;
        u = 3;
      } else {
        l = 7;
        u = 4;
      }
    }
  }
}
function Q(e, t, n) {
  var r;
  var i;
  var o = -1;
  var a = t[1];
  var s = 0;
  var l = 7;
  var u = 4;
  if (a === 0) {
    l = 138;
    u = 3;
  }
  r = 0;
  for (; r <= n; r++) {
    i = a;
    a = t[(r + 1) * 2 + 1];
    if (!(++s < l) || i !== a) {
      if (s < u) {
        do {
          V(e, i, e.bl_tree);
        } while (--s != 0);
      } else if (i !== 0) {
        if (i !== o) {
          V(e, i, e.bl_tree);
          s--;
        }
        V(e, x, e.bl_tree);
        H(e, s - 3, 2);
      } else if (s <= 10) {
        V(e, E, e.bl_tree);
        H(e, s - 3, 3);
      } else {
        V(e, S, e.bl_tree);
        H(e, s - 11, 7);
      }
      s = 0;
      o = i;
      if (a === 0) {
        l = 138;
        u = 3;
      } else if (i === a) {
        l = 6;
        u = 3;
      } else {
        l = 7;
        u = 4;
      }
    }
  }
}
l(j);
var ee = false;
function te(e, t, n, i) {
  H(e, (u << 1) + (i ? 1 : 0), 3);
  (function (e, t, n, i) {
    K(e);
    if (i) {
      z(e, n);
      z(e, ~n);
    }
    r.arraySet(e.pending_buf, e.window, t, n, e.pending);
    e.pending += n;
  })(e, t, n, true);
}
exports._tr_init = function (e) {
  if (!ee) {
    (function () {
      var e;
      var t;
      var n;
      var r;
      var i;
      var o = new Array(v + 1);
      n = 0;
      r = 0;
      for (; r < f - 1; r++) {
        R[r] = n;
        e = 0;
        for (; e < 1 << T[r]; e++) {
          L[n++] = r;
        }
      }
      L[n - 1] = r;
      i = 0;
      r = 0;
      for (; r < 16; r++) {
        j[r] = i;
        e = 0;
        for (; e < 1 << k[r]; e++) {
          M[i++] = r;
        }
      }
      for (i >>= 7; r < m; r++) {
        j[r] = i << 7;
        e = 0;
        for (; e < 1 << k[r] - 7; e++) {
          M[256 + i++] = r;
        }
      }
      for (t = 0; t <= v; t++) {
        o[t] = 0;
      }
      for (e = 0; e <= 143;) {
        C[e * 2 + 1] = 8;
        e++;
        o[8]++;
      }
      while (e <= 255) {
        C[e * 2 + 1] = 9;
        e++;
        o[9]++;
      }
      while (e <= 279) {
        C[e * 2 + 1] = 7;
        e++;
        o[7]++;
      }
      while (e <= 287) {
        C[e * 2 + 1] = 8;
        e++;
        o[8]++;
      }
      q(C, h + 1, o);
      e = 0;
      for (; e < m; e++) {
        I[e * 2 + 1] = 5;
        I[e * 2] = W(e, 5);
      }
      A = new F(C, T, p + 1, h, v);
      D = new F(I, k, 0, m, v);
      N = new F(new Array(0), O, 0, y, _);
    })();
    ee = true;
  }
  e.l_desc = new B(e.dyn_ltree, A);
  e.d_desc = new B(e.dyn_dtree, D);
  e.bl_desc = new B(e.bl_tree, N);
  e.bi_buf = 0;
  e.bi_valid = 0;
  G(e);
};
exports._tr_stored_block = te;
exports._tr_flush_block = function (e, t, n, r) {
  var l;
  var u;
  var f = 0;
  if (e.level > 0) {
    if (e.strm.data_type === s) {
      e.strm.data_type = function (e) {
        var t;
        var n = 4093624447;
        for (t = 0; t <= 31; t++, n >>>= 1) {
          if (n & 1 && e.dyn_ltree[t * 2] !== 0) {
            return o;
          }
        }
        if (e.dyn_ltree[18] !== 0 || e.dyn_ltree[20] !== 0 || e.dyn_ltree[26] !== 0) {
          return a;
        }
        for (t = 32; t < p; t++) {
          if (e.dyn_ltree[t * 2] !== 0) {
            return a;
          }
        }
        return o;
      }(e);
    }
    Z(e, e.l_desc);
    Z(e, e.d_desc);
    f = function (e) {
      var t;
      J(e, e.dyn_ltree, e.l_desc.max_code);
      J(e, e.dyn_dtree, e.d_desc.max_code);
      Z(e, e.bl_desc);
      t = y - 1;
      for (; t >= 3 && e.bl_tree[P[t] * 2 + 1] === 0; t--);
      e.opt_len += (t + 1) * 3 + 5 + 5 + 4;
      return t;
    }(e);
    l = e.opt_len + 3 + 7 >>> 3;
    if ((u = e.static_len + 3 + 7 >>> 3) <= l) {
      l = u;
    }
  } else {
    l = u = n + 5;
  }
  if (n + 4 <= l && t !== -1) {
    te(e, t, n, r);
  } else if (e.strategy === i || u === l) {
    H(e, (c << 1) + (r ? 1 : 0), 3);
    X(e, C, I);
  } else {
    H(e, (d << 1) + (r ? 1 : 0), 3);
    (function (e, t, n, r) {
      var i;
      H(e, t - 257, 5);
      H(e, n - 1, 5);
      H(e, r - 4, 4);
      i = 0;
      for (; i < r; i++) {
        H(e, e.bl_tree[P[i] * 2 + 1], 3);
      }
      Q(e, e.dyn_ltree, t - 1);
      Q(e, e.dyn_dtree, n - 1);
    })(e, e.l_desc.max_code + 1, e.d_desc.max_code + 1, f + 1);
    X(e, e.dyn_ltree, e.dyn_dtree);
  }
  G(e);
  if (r) {
    K(e);
  }
};
exports._tr_tally = function (e, t, n) {
  e.pending_buf[e.d_buf + e.last_lit * 2] = t >>> 8 & 255;
  e.pending_buf[e.d_buf + e.last_lit * 2 + 1] = t & 255;
  e.pending_buf[e.l_buf + e.last_lit] = n & 255;
  e.last_lit++;
  if (t === 0) {
    e.dyn_ltree[n * 2]++;
  } else {
    e.matches++;
    t--;
    e.dyn_ltree[(L[n] + p + 1) * 2]++;
    e.dyn_dtree[U(t) * 2]++;
  }
  return e.last_lit === e.lit_bufsize - 1;
};
exports._tr_align = function (e) {
  H(e, c << 1, 3);
  V(e, w, C);
  (function (e) {
    if (e.bi_valid === 16) {
      z(e, e.bi_buf);
      e.bi_buf = 0;
      e.bi_valid = 0;
    } else if (e.bi_valid >= 8) {
      e.pending_buf[e.pending++] = e.bi_buf & 255;
      e.bi_buf >>= 8;
      e.bi_valid -= 8;
    }
  })(e);
};