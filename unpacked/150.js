var r = typeof Uint8Array != "undefined" && typeof Uint16Array != "undefined" && typeof Int32Array != "undefined";
exports.assign = function (e) {
  for (var t = Array.prototype.slice.call(arguments, 1); t.length;) {
    var n = t.shift();
    if (n) {
      if (typeof n != "object") {
        throw new TypeError(n + "must be non-object");
      }
      for (var r in n) {
        if (n.hasOwnProperty(r)) {
          e[r] = n[r];
        }
      }
    }
  }
  return e;
};
exports.shrinkBuf = function (e, t) {
  if (e.length === t) {
    return e;
  } else if (e.subarray) {
    return e.subarray(0, t);
  } else {
    e.length = t;
    return e;
  }
};
var i = {
  arraySet: function (e, t, n, r, i) {
    if (t.subarray && e.subarray) {
      e.set(t.subarray(n, n + r), i);
    } else {
      for (var o = 0; o < r; o++) {
        e[i + o] = t[n + o];
      }
    }
  },
  flattenChunks: function (e) {
    var t;
    var n;
    var r;
    var i;
    var o;
    var a;
    r = 0;
    t = 0;
    n = e.length;
    for (; t < n; t++) {
      r += e[t].length;
    }
    a = new Uint8Array(r);
    i = 0;
    t = 0;
    n = e.length;
    for (; t < n; t++) {
      o = e[t];
      a.set(o, i);
      i += o.length;
    }
    return a;
  }
};
var o = {
  arraySet: function (e, t, n, r, i) {
    for (var o = 0; o < r; o++) {
      e[i + o] = t[n + o];
    }
  },
  flattenChunks: function (e) {
    return [].concat.apply([], e);
  }
};
exports.setTyped = function (e) {
  if (e) {
    exports.Buf8 = Uint8Array;
    exports.Buf16 = Uint16Array;
    exports.Buf32 = Int32Array;
    exports.assign(exports, i);
  } else {
    exports.Buf8 = Array;
    exports.Buf16 = Array;
    exports.Buf32 = Array;
    exports.assign(exports, o);
  }
};
exports.setTyped(r);