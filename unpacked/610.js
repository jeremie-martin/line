var r = require("./611.js");
var i = require("./150.js");
var o = require("./615.js");
var a = require("./311.js");
var s = require("./616.js");
var l = Object.prototype.toString;
var u = 0;
var c = -1;
var d = 0;
var f = 8;
function p(e) {
  if (!(this instanceof p)) {
    return new p(e);
  }
  this.options = i.assign({
    level: c,
    method: f,
    chunkSize: 16384,
    windowBits: 15,
    memLevel: 8,
    strategy: d,
    to: ""
  }, e || {});
  var t = this.options;
  if (t.raw && t.windowBits > 0) {
    t.windowBits = -t.windowBits;
  } else if (t.gzip && t.windowBits > 0 && t.windowBits < 16) {
    t.windowBits += 16;
  }
  this.err = 0;
  this.msg = "";
  this.ended = false;
  this.chunks = [];
  this.strm = new s();
  this.strm.avail_out = 0;
  var n = r.deflateInit2(this.strm, t.level, t.method, t.windowBits, t.memLevel, t.strategy);
  if (n !== u) {
    throw new Error(a[n]);
  }
  if (t.header) {
    r.deflateSetHeader(this.strm, t.header);
  }
  if (t.dictionary) {
    var h;
    h = typeof t.dictionary == "string" ? o.string2buf(t.dictionary) : l.call(t.dictionary) === "[object ArrayBuffer]" ? new Uint8Array(t.dictionary) : t.dictionary;
    if ((n = r.deflateSetDictionary(this.strm, h)) !== u) {
      throw new Error(a[n]);
    }
    this._dict_set = true;
  }
}
function h(e, t) {
  var n = new p(t);
  n.push(e, true);
  if (n.err) {
    throw n.msg || a[n.err];
  }
  return n.result;
}
p.prototype.push = function (e, t) {
  var n;
  var a;
  var s = this.strm;
  var c = this.options.chunkSize;
  if (this.ended) {
    return false;
  }
  a = t === ~~t ? t : t === true ? 4 : 0;
  if (typeof e == "string") {
    s.input = o.string2buf(e);
  } else if (l.call(e) === "[object ArrayBuffer]") {
    s.input = new Uint8Array(e);
  } else {
    s.input = e;
  }
  s.next_in = 0;
  s.avail_in = s.input.length;
  do {
    if (s.avail_out === 0) {
      s.output = new i.Buf8(c);
      s.next_out = 0;
      s.avail_out = c;
    }
    if ((n = r.deflate(s, a)) !== 1 && n !== u) {
      this.onEnd(n);
      this.ended = true;
      return false;
    }
    if (s.avail_out === 0 || s.avail_in === 0 && (a === 4 || a === 2)) {
      if (this.options.to === "string") {
        this.onData(o.buf2binstring(i.shrinkBuf(s.output, s.next_out)));
      } else {
        this.onData(i.shrinkBuf(s.output, s.next_out));
      }
    }
  } while ((s.avail_in > 0 || s.avail_out === 0) && n !== 1);
  if (a === 4) {
    n = r.deflateEnd(this.strm);
    this.onEnd(n);
    this.ended = true;
    return n === u;
  } else {
    return a !== 2 || (this.onEnd(u), s.avail_out = 0, true);
  }
};
p.prototype.onData = function (e) {
  this.chunks.push(e);
};
p.prototype.onEnd = function (e) {
  if (e === u) {
    if (this.options.to === "string") {
      this.result = this.chunks.join("");
    } else {
      this.result = i.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = e;
  this.msg = this.strm.msg;
};
exports.Deflate = p;
exports.deflate = h;
exports.deflateRaw = function (e, t) {
  (t = t || {}).raw = true;
  return h(e, t);
};
exports.gzip = function (e, t) {
  (t = t || {}).gzip = true;
  return h(e, t);
};