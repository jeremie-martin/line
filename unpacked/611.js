var r;
var i = require("./150.js");
var o = require("./612.js");
var a = require("./613.js");
var s = require("./614.js");
var l = require("./311.js");
var u = 0;
var c = 1;
var d = 3;
var f = 4;
var p = 5;
var h = 0;
var m = 1;
var y = -2;
var g = -3;
var v = -5;
var b = -1;
var _ = 1;
var w = 2;
var x = 3;
var E = 4;
var S = 0;
var T = 2;
var k = 8;
var O = 9;
var P = 15;
var C = 8;
var I = 286;
var M = 30;
var L = 19;
var R = I * 2 + 1;
var A = 15;
var D = 3;
var N = 258;
var j = N + D + 1;
var F = 32;
var B = 42;
var U = 69;
var z = 73;
var H = 91;
var V = 103;
var W = 113;
var q = 666;
var G = 1;
var K = 2;
var Y = 3;
var $ = 4;
var X = 3;
function Z(e, t) {
  e.msg = l[t];
  return t;
}
function J(e) {
  return (e << 1) - (e > 4 ? 9 : 0);
}
function Q(e) {
  for (var t = e.length; --t >= 0;) {
    e[t] = 0;
  }
}
function ee(e) {
  var t = e.state;
  var n = t.pending;
  if (n > e.avail_out) {
    n = e.avail_out;
  }
  if (n !== 0) {
    i.arraySet(e.output, t.pending_buf, t.pending_out, n, e.next_out);
    e.next_out += n;
    t.pending_out += n;
    e.total_out += n;
    e.avail_out -= n;
    t.pending -= n;
    if (t.pending === 0) {
      t.pending_out = 0;
    }
  }
}
function te(e, t) {
  o._tr_flush_block(e, e.block_start >= 0 ? e.block_start : -1, e.strstart - e.block_start, t);
  e.block_start = e.strstart;
  ee(e.strm);
}
function ne(e, t) {
  e.pending_buf[e.pending++] = t;
}
function re(e, t) {
  e.pending_buf[e.pending++] = t >>> 8 & 255;
  e.pending_buf[e.pending++] = t & 255;
}
function ie(e, t) {
  var n;
  var r;
  var i = e.max_chain_length;
  var o = e.strstart;
  var a = e.prev_length;
  var s = e.nice_match;
  var l = e.strstart > e.w_size - j ? e.strstart - (e.w_size - j) : 0;
  var u = e.window;
  var c = e.w_mask;
  var d = e.prev;
  var f = e.strstart + N;
  var p = u[o + a - 1];
  var h = u[o + a];
  if (e.prev_length >= e.good_match) {
    i >>= 2;
  }
  if (s > e.lookahead) {
    s = e.lookahead;
  }
  do {
    if (u[(n = t) + a] === h && u[n + a - 1] === p && u[n] === u[o] && u[++n] === u[o + 1]) {
      o += 2;
      n++;
      do {} while (u[++o] === u[++n] && u[++o] === u[++n] && u[++o] === u[++n] && u[++o] === u[++n] && u[++o] === u[++n] && u[++o] === u[++n] && u[++o] === u[++n] && u[++o] === u[++n] && o < f);
      r = N - (f - o);
      o = f - N;
      if (r > a) {
        e.match_start = t;
        a = r;
        if (r >= s) {
          break;
        }
        p = u[o + a - 1];
        h = u[o + a];
      }
    }
  } while ((t = d[t & c]) > l && --i != 0);
  if (a <= e.lookahead) {
    return a;
  } else {
    return e.lookahead;
  }
}
function oe(e) {
  var t;
  var n;
  var r;
  var o;
  var l;
  var u;
  var c;
  var d;
  var f;
  var p;
  var h = e.w_size;
  do {
    o = e.window_size - e.lookahead - e.strstart;
    if (e.strstart >= h + (h - j)) {
      i.arraySet(e.window, e.window, h, h, 0);
      e.match_start -= h;
      e.strstart -= h;
      e.block_start -= h;
      t = n = e.hash_size;
      do {
        r = e.head[--t];
        e.head[t] = r >= h ? r - h : 0;
      } while (--n);
      t = n = h;
      do {
        r = e.prev[--t];
        e.prev[t] = r >= h ? r - h : 0;
      } while (--n);
      o += h;
    }
    if (e.strm.avail_in === 0) {
      break;
    }
    u = e.strm;
    c = e.window;
    d = e.strstart + e.lookahead;
    f = o;
    p = undefined;
    if ((p = u.avail_in) > f) {
      p = f;
    }
    n = p === 0 ? 0 : (u.avail_in -= p, i.arraySet(c, u.input, u.next_in, p, d), u.state.wrap === 1 ? u.adler = a(u.adler, c, p, d) : u.state.wrap === 2 && (u.adler = s(u.adler, c, p, d)), u.next_in += p, u.total_in += p, p);
    e.lookahead += n;
    if (e.lookahead + e.insert >= D) {
      l = e.strstart - e.insert;
      e.ins_h = e.window[l];
      e.ins_h = (e.ins_h << e.hash_shift ^ e.window[l + 1]) & e.hash_mask;
      while (e.insert && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[l + D - 1]) & e.hash_mask, e.prev[l & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = l, l++, e.insert--, !(e.lookahead + e.insert < D)));
    }
  } while (e.lookahead < j && e.strm.avail_in !== 0);
}
function ae(e, t) {
  var n;
  var r;
  while (true) {
    if (e.lookahead < j) {
      oe(e);
      if (e.lookahead < j && t === u) {
        return G;
      }
      if (e.lookahead === 0) {
        break;
      }
    }
    n = 0;
    if (e.lookahead >= D) {
      e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + D - 1]) & e.hash_mask;
      n = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h];
      e.head[e.ins_h] = e.strstart;
    }
    if (n !== 0 && e.strstart - n <= e.w_size - j) {
      e.match_length = ie(e, n);
    }
    if (e.match_length >= D) {
      r = o._tr_tally(e, e.strstart - e.match_start, e.match_length - D);
      e.lookahead -= e.match_length;
      if (e.match_length <= e.max_lazy_match && e.lookahead >= D) {
        e.match_length--;
        do {
          e.strstart++;
          e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + D - 1]) & e.hash_mask;
          n = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h];
          e.head[e.ins_h] = e.strstart;
        } while (--e.match_length != 0);
        e.strstart++;
      } else {
        e.strstart += e.match_length;
        e.match_length = 0;
        e.ins_h = e.window[e.strstart];
        e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + 1]) & e.hash_mask;
      }
    } else {
      r = o._tr_tally(e, 0, e.window[e.strstart]);
      e.lookahead--;
      e.strstart++;
    }
    if (r && (te(e, false), e.strm.avail_out === 0)) {
      return G;
    }
  }
  e.insert = e.strstart < D - 1 ? e.strstart : D - 1;
  if (t === f) {
    te(e, true);
    if (e.strm.avail_out === 0) {
      return Y;
    } else {
      return $;
    }
  } else if (e.last_lit && (te(e, false), e.strm.avail_out === 0)) {
    return G;
  } else {
    return K;
  }
}
function se(e, t) {
  var n;
  var r;
  var i;
  while (true) {
    if (e.lookahead < j) {
      oe(e);
      if (e.lookahead < j && t === u) {
        return G;
      }
      if (e.lookahead === 0) {
        break;
      }
    }
    n = 0;
    if (e.lookahead >= D) {
      e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + D - 1]) & e.hash_mask;
      n = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h];
      e.head[e.ins_h] = e.strstart;
    }
    e.prev_length = e.match_length;
    e.prev_match = e.match_start;
    e.match_length = D - 1;
    if (n !== 0 && e.prev_length < e.max_lazy_match && e.strstart - n <= e.w_size - j) {
      e.match_length = ie(e, n);
      if (e.match_length <= 5 && (e.strategy === _ || e.match_length === D && e.strstart - e.match_start > 4096)) {
        e.match_length = D - 1;
      }
    }
    if (e.prev_length >= D && e.match_length <= e.prev_length) {
      i = e.strstart + e.lookahead - D;
      r = o._tr_tally(e, e.strstart - 1 - e.prev_match, e.prev_length - D);
      e.lookahead -= e.prev_length - 1;
      e.prev_length -= 2;
      do {
        if (++e.strstart <= i) {
          e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + D - 1]) & e.hash_mask;
          n = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h];
          e.head[e.ins_h] = e.strstart;
        }
      } while (--e.prev_length != 0);
      e.match_available = 0;
      e.match_length = D - 1;
      e.strstart++;
      if (r && (te(e, false), e.strm.avail_out === 0)) {
        return G;
      }
    } else if (e.match_available) {
      if (r = o._tr_tally(e, 0, e.window[e.strstart - 1])) {
        te(e, false);
      }
      e.strstart++;
      e.lookahead--;
      if (e.strm.avail_out === 0) {
        return G;
      }
    } else {
      e.match_available = 1;
      e.strstart++;
      e.lookahead--;
    }
  }
  if (e.match_available) {
    r = o._tr_tally(e, 0, e.window[e.strstart - 1]);
    e.match_available = 0;
  }
  e.insert = e.strstart < D - 1 ? e.strstart : D - 1;
  if (t === f) {
    te(e, true);
    if (e.strm.avail_out === 0) {
      return Y;
    } else {
      return $;
    }
  } else if (e.last_lit && (te(e, false), e.strm.avail_out === 0)) {
    return G;
  } else {
    return K;
  }
}
function le(e, t, n, r, i) {
  this.good_length = e;
  this.max_lazy = t;
  this.nice_length = n;
  this.max_chain = r;
  this.func = i;
}
function ue(e) {
  var t;
  if (e && e.state) {
    e.total_in = e.total_out = 0;
    e.data_type = T;
    (t = e.state).pending = 0;
    t.pending_out = 0;
    if (t.wrap < 0) {
      t.wrap = -t.wrap;
    }
    t.status = t.wrap ? B : W;
    e.adler = t.wrap === 2 ? 0 : 1;
    t.last_flush = u;
    o._tr_init(t);
    return h;
  } else {
    return Z(e, y);
  }
}
function ce(e) {
  var t;
  var n = ue(e);
  if (n === h) {
    (t = e.state).window_size = t.w_size * 2;
    Q(t.head);
    t.max_lazy_match = r[t.level].max_lazy;
    t.good_match = r[t.level].good_length;
    t.nice_match = r[t.level].nice_length;
    t.max_chain_length = r[t.level].max_chain;
    t.strstart = 0;
    t.block_start = 0;
    t.lookahead = 0;
    t.insert = 0;
    t.match_length = t.prev_length = D - 1;
    t.match_available = 0;
    t.ins_h = 0;
  }
  return n;
}
function de(e, t, n, r, o, a) {
  if (!e) {
    return y;
  }
  var s = 1;
  if (t === b) {
    t = 6;
  }
  if (r < 0) {
    s = 0;
    r = -r;
  } else if (r > 15) {
    s = 2;
    r -= 16;
  }
  if (o < 1 || o > O || n !== k || r < 8 || r > 15 || t < 0 || t > 9 || a < 0 || a > E) {
    return Z(e, y);
  }
  if (r === 8) {
    r = 9;
  }
  var l = new function () {
    this.strm = null;
    this.status = 0;
    this.pending_buf = null;
    this.pending_buf_size = 0;
    this.pending_out = 0;
    this.pending = 0;
    this.wrap = 0;
    this.gzhead = null;
    this.gzindex = 0;
    this.method = k;
    this.last_flush = -1;
    this.w_size = 0;
    this.w_bits = 0;
    this.w_mask = 0;
    this.window = null;
    this.window_size = 0;
    this.prev = null;
    this.head = null;
    this.ins_h = 0;
    this.hash_size = 0;
    this.hash_bits = 0;
    this.hash_mask = 0;
    this.hash_shift = 0;
    this.block_start = 0;
    this.match_length = 0;
    this.prev_match = 0;
    this.match_available = 0;
    this.strstart = 0;
    this.match_start = 0;
    this.lookahead = 0;
    this.prev_length = 0;
    this.max_chain_length = 0;
    this.max_lazy_match = 0;
    this.level = 0;
    this.strategy = 0;
    this.good_match = 0;
    this.nice_match = 0;
    this.dyn_ltree = new i.Buf16(R * 2);
    this.dyn_dtree = new i.Buf16((M * 2 + 1) * 2);
    this.bl_tree = new i.Buf16((L * 2 + 1) * 2);
    Q(this.dyn_ltree);
    Q(this.dyn_dtree);
    Q(this.bl_tree);
    this.l_desc = null;
    this.d_desc = null;
    this.bl_desc = null;
    this.bl_count = new i.Buf16(A + 1);
    this.heap = new i.Buf16(I * 2 + 1);
    Q(this.heap);
    this.heap_len = 0;
    this.heap_max = 0;
    this.depth = new i.Buf16(I * 2 + 1);
    Q(this.depth);
    this.l_buf = 0;
    this.lit_bufsize = 0;
    this.last_lit = 0;
    this.d_buf = 0;
    this.opt_len = 0;
    this.static_len = 0;
    this.matches = 0;
    this.insert = 0;
    this.bi_buf = 0;
    this.bi_valid = 0;
  }();
  e.state = l;
  l.strm = e;
  l.wrap = s;
  l.gzhead = null;
  l.w_bits = r;
  l.w_size = 1 << l.w_bits;
  l.w_mask = l.w_size - 1;
  l.hash_bits = o + 7;
  l.hash_size = 1 << l.hash_bits;
  l.hash_mask = l.hash_size - 1;
  l.hash_shift = ~~((l.hash_bits + D - 1) / D);
  l.window = new i.Buf8(l.w_size * 2);
  l.head = new i.Buf16(l.hash_size);
  l.prev = new i.Buf16(l.w_size);
  l.lit_bufsize = 1 << o + 6;
  l.pending_buf_size = l.lit_bufsize * 4;
  l.pending_buf = new i.Buf8(l.pending_buf_size);
  l.d_buf = l.lit_bufsize * 1;
  l.l_buf = l.lit_bufsize * 3;
  l.level = t;
  l.strategy = a;
  l.method = n;
  return ce(e);
}
r = [new le(0, 0, 0, 0, function (e, t) {
  var n = 65535;
  for (n > e.pending_buf_size - 5 && (n = e.pending_buf_size - 5);;) {
    if (e.lookahead <= 1) {
      oe(e);
      if (e.lookahead === 0 && t === u) {
        return G;
      }
      if (e.lookahead === 0) {
        break;
      }
    }
    e.strstart += e.lookahead;
    e.lookahead = 0;
    var r = e.block_start + n;
    if ((e.strstart === 0 || e.strstart >= r) && (e.lookahead = e.strstart - r, e.strstart = r, te(e, false), e.strm.avail_out === 0)) {
      return G;
    }
    if (e.strstart - e.block_start >= e.w_size - j && (te(e, false), e.strm.avail_out === 0)) {
      return G;
    }
  }
  e.insert = 0;
  if (t === f) {
    te(e, true);
    if (e.strm.avail_out === 0) {
      return Y;
    } else {
      return $;
    }
  } else {
    if (e.strstart > e.block_start) {
      te(e, false);
      e.strm.avail_out;
    }
    return G;
  }
}), new le(4, 4, 8, 4, ae), new le(4, 5, 16, 8, ae), new le(4, 6, 32, 32, ae), new le(4, 4, 16, 16, se), new le(8, 16, 32, 32, se), new le(8, 16, 128, 128, se), new le(8, 32, 128, 256, se), new le(32, 128, 258, 1024, se), new le(32, 258, 258, 4096, se)];
exports.deflateInit = function (e, t) {
  return de(e, t, k, P, C, S);
};
exports.deflateInit2 = de;
exports.deflateReset = ce;
exports.deflateResetKeep = ue;
exports.deflateSetHeader = function (e, t) {
  if (e && e.state) {
    if (e.state.wrap !== 2) {
      return y;
    } else {
      e.state.gzhead = t;
      return h;
    }
  } else {
    return y;
  }
};
exports.deflate = function (e, t) {
  var n;
  var i;
  var a;
  var l;
  if (!e || !e.state || t > p || t < 0) {
    if (e) {
      return Z(e, y);
    } else {
      return y;
    }
  }
  i = e.state;
  if (!e.output || !e.input && e.avail_in !== 0 || i.status === q && t !== f) {
    return Z(e, e.avail_out === 0 ? v : y);
  }
  i.strm = e;
  n = i.last_flush;
  i.last_flush = t;
  if (i.status === B) {
    if (i.wrap === 2) {
      e.adler = 0;
      ne(i, 31);
      ne(i, 139);
      ne(i, 8);
      if (i.gzhead) {
        ne(i, (i.gzhead.text ? 1 : 0) + (i.gzhead.hcrc ? 2 : 0) + (i.gzhead.extra ? 4 : 0) + (i.gzhead.name ? 8 : 0) + (i.gzhead.comment ? 16 : 0));
        ne(i, i.gzhead.time & 255);
        ne(i, i.gzhead.time >> 8 & 255);
        ne(i, i.gzhead.time >> 16 & 255);
        ne(i, i.gzhead.time >> 24 & 255);
        ne(i, i.level === 9 ? 2 : i.strategy >= w || i.level < 2 ? 4 : 0);
        ne(i, i.gzhead.os & 255);
        if (i.gzhead.extra && i.gzhead.extra.length) {
          ne(i, i.gzhead.extra.length & 255);
          ne(i, i.gzhead.extra.length >> 8 & 255);
        }
        if (i.gzhead.hcrc) {
          e.adler = s(e.adler, i.pending_buf, i.pending, 0);
        }
        i.gzindex = 0;
        i.status = U;
      } else {
        ne(i, 0);
        ne(i, 0);
        ne(i, 0);
        ne(i, 0);
        ne(i, 0);
        ne(i, i.level === 9 ? 2 : i.strategy >= w || i.level < 2 ? 4 : 0);
        ne(i, X);
        i.status = W;
      }
    } else {
      var g = k + (i.w_bits - 8 << 4) << 8;
      g |= (i.strategy >= w || i.level < 2 ? 0 : i.level < 6 ? 1 : i.level === 6 ? 2 : 3) << 6;
      if (i.strstart !== 0) {
        g |= F;
      }
      g += 31 - g % 31;
      i.status = W;
      re(i, g);
      if (i.strstart !== 0) {
        re(i, e.adler >>> 16);
        re(i, e.adler & 65535);
      }
      e.adler = 1;
    }
  }
  if (i.status === U) {
    if (i.gzhead.extra) {
      for (a = i.pending; i.gzindex < (i.gzhead.extra.length & 65535) && (i.pending !== i.pending_buf_size || (i.gzhead.hcrc && i.pending > a && (e.adler = s(e.adler, i.pending_buf, i.pending - a, a)), ee(e), a = i.pending, i.pending !== i.pending_buf_size));) {
        ne(i, i.gzhead.extra[i.gzindex] & 255);
        i.gzindex++;
      }
      if (i.gzhead.hcrc && i.pending > a) {
        e.adler = s(e.adler, i.pending_buf, i.pending - a, a);
      }
      if (i.gzindex === i.gzhead.extra.length) {
        i.gzindex = 0;
        i.status = z;
      }
    } else {
      i.status = z;
    }
  }
  if (i.status === z) {
    if (i.gzhead.name) {
      a = i.pending;
      do {
        if (i.pending === i.pending_buf_size && (i.gzhead.hcrc && i.pending > a && (e.adler = s(e.adler, i.pending_buf, i.pending - a, a)), ee(e), a = i.pending, i.pending === i.pending_buf_size)) {
          l = 1;
          break;
        }
        l = i.gzindex < i.gzhead.name.length ? i.gzhead.name.charCodeAt(i.gzindex++) & 255 : 0;
        ne(i, l);
      } while (l !== 0);
      if (i.gzhead.hcrc && i.pending > a) {
        e.adler = s(e.adler, i.pending_buf, i.pending - a, a);
      }
      if (l === 0) {
        i.gzindex = 0;
        i.status = H;
      }
    } else {
      i.status = H;
    }
  }
  if (i.status === H) {
    if (i.gzhead.comment) {
      a = i.pending;
      do {
        if (i.pending === i.pending_buf_size && (i.gzhead.hcrc && i.pending > a && (e.adler = s(e.adler, i.pending_buf, i.pending - a, a)), ee(e), a = i.pending, i.pending === i.pending_buf_size)) {
          l = 1;
          break;
        }
        l = i.gzindex < i.gzhead.comment.length ? i.gzhead.comment.charCodeAt(i.gzindex++) & 255 : 0;
        ne(i, l);
      } while (l !== 0);
      if (i.gzhead.hcrc && i.pending > a) {
        e.adler = s(e.adler, i.pending_buf, i.pending - a, a);
      }
      if (l === 0) {
        i.status = V;
      }
    } else {
      i.status = V;
    }
  }
  if (i.status === V) {
    if (i.gzhead.hcrc) {
      if (i.pending + 2 > i.pending_buf_size) {
        ee(e);
      }
      if (i.pending + 2 <= i.pending_buf_size) {
        ne(i, e.adler & 255);
        ne(i, e.adler >> 8 & 255);
        e.adler = 0;
        i.status = W;
      }
    } else {
      i.status = W;
    }
  }
  if (i.pending !== 0) {
    ee(e);
    if (e.avail_out === 0) {
      i.last_flush = -1;
      return h;
    }
  } else if (e.avail_in === 0 && J(t) <= J(n) && t !== f) {
    return Z(e, v);
  }
  if (i.status === q && e.avail_in !== 0) {
    return Z(e, v);
  }
  if (e.avail_in !== 0 || i.lookahead !== 0 || t !== u && i.status !== q) {
    var b = i.strategy === w ? function (e, t) {
      var n;
      while (true) {
        if (e.lookahead === 0 && (oe(e), e.lookahead === 0)) {
          if (t === u) {
            return G;
          }
          break;
        }
        e.match_length = 0;
        n = o._tr_tally(e, 0, e.window[e.strstart]);
        e.lookahead--;
        e.strstart++;
        if (n && (te(e, false), e.strm.avail_out === 0)) {
          return G;
        }
      }
      e.insert = 0;
      if (t === f) {
        te(e, true);
        if (e.strm.avail_out === 0) {
          return Y;
        } else {
          return $;
        }
      } else if (e.last_lit && (te(e, false), e.strm.avail_out === 0)) {
        return G;
      } else {
        return K;
      }
    }(i, t) : i.strategy === x ? function (e, t) {
      var n;
      var r;
      var i;
      var a;
      var s = e.window;
      while (true) {
        if (e.lookahead <= N) {
          oe(e);
          if (e.lookahead <= N && t === u) {
            return G;
          }
          if (e.lookahead === 0) {
            break;
          }
        }
        e.match_length = 0;
        if (e.lookahead >= D && e.strstart > 0 && (r = s[i = e.strstart - 1]) === s[++i] && r === s[++i] && r === s[++i]) {
          a = e.strstart + N;
          do {} while (r === s[++i] && r === s[++i] && r === s[++i] && r === s[++i] && r === s[++i] && r === s[++i] && r === s[++i] && r === s[++i] && i < a);
          e.match_length = N - (a - i);
          if (e.match_length > e.lookahead) {
            e.match_length = e.lookahead;
          }
        }
        if (e.match_length >= D) {
          n = o._tr_tally(e, 1, e.match_length - D);
          e.lookahead -= e.match_length;
          e.strstart += e.match_length;
          e.match_length = 0;
        } else {
          n = o._tr_tally(e, 0, e.window[e.strstart]);
          e.lookahead--;
          e.strstart++;
        }
        if (n && (te(e, false), e.strm.avail_out === 0)) {
          return G;
        }
      }
      e.insert = 0;
      if (t === f) {
        te(e, true);
        if (e.strm.avail_out === 0) {
          return Y;
        } else {
          return $;
        }
      } else if (e.last_lit && (te(e, false), e.strm.avail_out === 0)) {
        return G;
      } else {
        return K;
      }
    }(i, t) : r[i.level].func(i, t);
    if (b === Y || b === $) {
      i.status = q;
    }
    if (b === G || b === Y) {
      if (e.avail_out === 0) {
        i.last_flush = -1;
      }
      return h;
    }
    if (b === K && (t === c ? o._tr_align(i) : t !== p && (o._tr_stored_block(i, 0, 0, false), t === d && (Q(i.head), i.lookahead === 0 && (i.strstart = 0, i.block_start = 0, i.insert = 0))), ee(e), e.avail_out === 0)) {
      i.last_flush = -1;
      return h;
    }
  }
  if (t !== f) {
    return h;
  } else if (i.wrap <= 0) {
    return m;
  } else {
    if (i.wrap === 2) {
      ne(i, e.adler & 255);
      ne(i, e.adler >> 8 & 255);
      ne(i, e.adler >> 16 & 255);
      ne(i, e.adler >> 24 & 255);
      ne(i, e.total_in & 255);
      ne(i, e.total_in >> 8 & 255);
      ne(i, e.total_in >> 16 & 255);
      ne(i, e.total_in >> 24 & 255);
    } else {
      re(i, e.adler >>> 16);
      re(i, e.adler & 65535);
    }
    ee(e);
    if (i.wrap > 0) {
      i.wrap = -i.wrap;
    }
    if (i.pending !== 0) {
      return h;
    } else {
      return m;
    }
  }
};
exports.deflateEnd = function (e) {
  var t;
  if (e && e.state) {
    if ((t = e.state.status) !== B && t !== U && t !== z && t !== H && t !== V && t !== W && t !== q) {
      return Z(e, y);
    } else {
      e.state = null;
      if (t === W) {
        return Z(e, g);
      } else {
        return h;
      }
    }
  } else {
    return y;
  }
};
exports.deflateSetDictionary = function (e, t) {
  var n;
  var r;
  var o;
  var s;
  var l;
  var u;
  var c;
  var d;
  var f = t.length;
  if (!e || !e.state) {
    return y;
  }
  if ((s = (n = e.state).wrap) === 2 || s === 1 && n.status !== B || n.lookahead) {
    return y;
  }
  if (s === 1) {
    e.adler = a(e.adler, t, f, 0);
  }
  n.wrap = 0;
  if (f >= n.w_size) {
    if (s === 0) {
      Q(n.head);
      n.strstart = 0;
      n.block_start = 0;
      n.insert = 0;
    }
    d = new i.Buf8(n.w_size);
    i.arraySet(d, t, f - n.w_size, n.w_size, 0);
    t = d;
    f = n.w_size;
  }
  l = e.avail_in;
  u = e.next_in;
  c = e.input;
  e.avail_in = f;
  e.next_in = 0;
  e.input = t;
  oe(n);
  while (n.lookahead >= D) {
    r = n.strstart;
    o = n.lookahead - (D - 1);
    do {
      n.ins_h = (n.ins_h << n.hash_shift ^ n.window[r + D - 1]) & n.hash_mask;
      n.prev[r & n.w_mask] = n.head[n.ins_h];
      n.head[n.ins_h] = r;
      r++;
    } while (--o);
    n.strstart = r;
    n.lookahead = D - 1;
    oe(n);
  }
  n.strstart += n.lookahead;
  n.block_start = n.strstart;
  n.insert = n.lookahead;
  n.lookahead = 0;
  n.match_length = n.prev_length = D - 1;
  n.match_available = 0;
  e.next_in = u;
  e.input = c;
  e.avail_in = l;
  n.wrap = s;
  return h;
};
exports.deflateInfo = "pako deflate (from Nodeca project)";