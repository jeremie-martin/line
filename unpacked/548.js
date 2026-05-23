module.exports = function () {
  "use strict";

  var e = Array.prototype.slice;
  function t(e, t) {
    if (t) {
      e.prototype = Object.create(t.prototype);
    }
    e.prototype.constructor = e;
  }
  function n(e) {
    if (a(e)) {
      return e;
    } else {
      return G(e);
    }
  }
  function r(e) {
    if (s(e)) {
      return e;
    } else {
      return K(e);
    }
  }
  function i(e) {
    if (l(e)) {
      return e;
    } else {
      return Y(e);
    }
  }
  function o(e) {
    if (a(e) && !u(e)) {
      return e;
    } else {
      return $(e);
    }
  }
  function a(e) {
    return !!e && !!e[d];
  }
  function s(e) {
    return !!e && !!e[f];
  }
  function l(e) {
    return !!e && !!e[p];
  }
  function u(e) {
    return s(e) || l(e);
  }
  function c(e) {
    return !!e && !!e[h];
  }
  t(r, n);
  t(i, n);
  t(o, n);
  n.isIterable = a;
  n.isKeyed = s;
  n.isIndexed = l;
  n.isAssociative = u;
  n.isOrdered = c;
  n.Keyed = r;
  n.Indexed = i;
  n.Set = o;
  var d = "@@__IMMUTABLE_ITERABLE__@@";
  var f = "@@__IMMUTABLE_KEYED__@@";
  var p = "@@__IMMUTABLE_INDEXED__@@";
  var h = "@@__IMMUTABLE_ORDERED__@@";
  var m = 5;
  var y = 1 << m;
  var g = y - 1;
  var v = {};
  var b = {
    value: false
  };
  var _ = {
    value: false
  };
  function w(e) {
    e.value = false;
    return e;
  }
  function x(e) {
    if (e) {
      e.value = true;
    }
  }
  function E() {}
  function S(e, t) {
    t = t || 0;
    for (var n = Math.max(0, e.length - t), r = new Array(n), i = 0; i < n; i++) {
      r[i] = e[i + t];
    }
    return r;
  }
  function T(e) {
    if (e.size === undefined) {
      e.size = e.__iterate(O);
    }
    return e.size;
  }
  function k(e, t) {
    if (typeof t != "number") {
      var n = t >>> 0;
      if ("" + n !== t || n === 4294967295) {
        return NaN;
      }
      t = n;
    }
    if (t < 0) {
      return T(e) + t;
    } else {
      return t;
    }
  }
  function O() {
    return true;
  }
  function P(e, t, n) {
    return (e === 0 || n !== undefined && e <= -n) && (t === undefined || n !== undefined && t >= n);
  }
  function C(e, t) {
    return M(e, t, 0);
  }
  function I(e, t) {
    return M(e, t, t);
  }
  function M(e, t, n) {
    if (e === undefined) {
      return n;
    } else if (e < 0) {
      return Math.max(0, t + e);
    } else if (t === undefined) {
      return e;
    } else {
      return Math.min(t, e);
    }
  }
  var L = 0;
  var R = 1;
  var A = 2;
  var D = typeof Symbol == "function" && Symbol.iterator;
  var N = "@@iterator";
  var j = D || N;
  function F(e) {
    this.next = e;
  }
  function B(e, t, n, r) {
    var i = e === 0 ? t : e === 1 ? n : [t, n];
    if (r) {
      r.value = i;
    } else {
      r = {
        value: i,
        done: false
      };
    }
    return r;
  }
  function U() {
    return {
      value: undefined,
      done: true
    };
  }
  function z(e) {
    return !!W(e);
  }
  function H(e) {
    return e && typeof e.next == "function";
  }
  function V(e) {
    var t = W(e);
    return t && t.call(e);
  }
  function W(e) {
    var t = e && (D && e[D] || e[N]);
    if (typeof t == "function") {
      return t;
    }
  }
  function q(e) {
    return e && typeof e.length == "number";
  }
  function G(e) {
    if (e === null || e === undefined) {
      return oe();
    } else if (a(e)) {
      return e.toSeq();
    } else {
      return function (e) {
        var t = le(e) || typeof e == "object" && new te(e);
        if (!t) {
          throw new TypeError("Expected Array or iterable object of values, or keyed object: " + e);
        }
        return t;
      }(e);
    }
  }
  function K(e) {
    if (e === null || e === undefined) {
      return oe().toKeyedSeq();
    } else if (a(e)) {
      if (s(e)) {
        return e.toSeq();
      } else {
        return e.fromEntrySeq();
      }
    } else {
      return ae(e);
    }
  }
  function Y(e) {
    if (e === null || e === undefined) {
      return oe();
    } else if (a(e)) {
      if (s(e)) {
        return e.entrySeq();
      } else {
        return e.toIndexedSeq();
      }
    } else {
      return se(e);
    }
  }
  function $(e) {
    return (e === null || e === undefined ? oe() : a(e) ? s(e) ? e.entrySeq() : e : se(e)).toSetSeq();
  }
  F.prototype.toString = function () {
    return "[Iterator]";
  };
  F.KEYS = L;
  F.VALUES = R;
  F.ENTRIES = A;
  F.prototype.inspect = F.prototype.toSource = function () {
    return this.toString();
  };
  F.prototype[j] = function () {
    return this;
  };
  t(G, n);
  G.of = function () {
    return G(arguments);
  };
  G.prototype.toSeq = function () {
    return this;
  };
  G.prototype.toString = function () {
    return this.__toString("Seq {", "}");
  };
  G.prototype.cacheResult = function () {
    if (!this._cache && this.__iterateUncached) {
      this._cache = this.entrySeq().toArray();
      this.size = this._cache.length;
    }
    return this;
  };
  G.prototype.__iterate = function (e, t) {
    return ue(this, e, t, true);
  };
  G.prototype.__iterator = function (e, t) {
    return ce(this, e, t, true);
  };
  t(K, G);
  K.prototype.toKeyedSeq = function () {
    return this;
  };
  t(Y, G);
  Y.of = function () {
    return Y(arguments);
  };
  Y.prototype.toIndexedSeq = function () {
    return this;
  };
  Y.prototype.toString = function () {
    return this.__toString("Seq [", "]");
  };
  Y.prototype.__iterate = function (e, t) {
    return ue(this, e, t, false);
  };
  Y.prototype.__iterator = function (e, t) {
    return ce(this, e, t, false);
  };
  t($, G);
  $.of = function () {
    return $(arguments);
  };
  $.prototype.toSetSeq = function () {
    return this;
  };
  G.isSeq = ie;
  G.Keyed = K;
  G.Set = $;
  G.Indexed = Y;
  var X;
  var Z;
  var J;
  var Q = "@@__IMMUTABLE_SEQ__@@";
  function ee(e) {
    this._array = e;
    this.size = e.length;
  }
  function te(e) {
    var t = Object.keys(e);
    this._object = e;
    this._keys = t;
    this.size = t.length;
  }
  function ne(e) {
    this._iterable = e;
    this.size = e.length || e.size;
  }
  function re(e) {
    this._iterator = e;
    this._iteratorCache = [];
  }
  function ie(e) {
    return !!e && !!e[Q];
  }
  function oe() {
    return X ||= new ee([]);
  }
  function ae(e) {
    var t = Array.isArray(e) ? new ee(e).fromEntrySeq() : H(e) ? new re(e).fromEntrySeq() : z(e) ? new ne(e).fromEntrySeq() : typeof e == "object" ? new te(e) : undefined;
    if (!t) {
      throw new TypeError("Expected Array or iterable object of [k, v] entries, or keyed object: " + e);
    }
    return t;
  }
  function se(e) {
    var t = le(e);
    if (!t) {
      throw new TypeError("Expected Array or iterable object of values: " + e);
    }
    return t;
  }
  function le(e) {
    if (q(e)) {
      return new ee(e);
    } else if (H(e)) {
      return new re(e);
    } else if (z(e)) {
      return new ne(e);
    } else {
      return undefined;
    }
  }
  function ue(e, t, n, r) {
    var i = e._cache;
    if (i) {
      for (var o = i.length - 1, a = 0; a <= o; a++) {
        var s = i[n ? o - a : a];
        if (t(s[1], r ? s[0] : a, e) === false) {
          return a + 1;
        }
      }
      return a;
    }
    return e.__iterateUncached(t, n);
  }
  function ce(e, t, n, r) {
    var i = e._cache;
    if (i) {
      var o = i.length - 1;
      var a = 0;
      return new F(function () {
        var e = i[n ? o - a : a];
        if (a++ > o) {
          return {
            value: undefined,
            done: true
          };
        } else {
          return B(t, r ? e[0] : a - 1, e[1]);
        }
      });
    }
    return e.__iteratorUncached(t, n);
  }
  function de(e, t) {
    if (t) {
      return function e(t, n, r, i) {
        if (Array.isArray(n)) {
          return t.call(i, r, Y(n).map(function (r, i) {
            return e(t, r, i, n);
          }));
        } else if (pe(n)) {
          return t.call(i, r, K(n).map(function (r, i) {
            return e(t, r, i, n);
          }));
        } else {
          return n;
        }
      }(t, e, "", {
        "": e
      });
    } else {
      return fe(e);
    }
  }
  function fe(e) {
    if (Array.isArray(e)) {
      return Y(e).map(fe).toList();
    } else if (pe(e)) {
      return K(e).map(fe).toMap();
    } else {
      return e;
    }
  }
  function pe(e) {
    return e && (e.constructor === Object || e.constructor === undefined);
  }
  function he(e, t) {
    if (e === t || e != e && t != t) {
      return true;
    }
    if (!e || !t) {
      return false;
    }
    if (typeof e.valueOf == "function" && typeof t.valueOf == "function") {
      e = e.valueOf();
      t = t.valueOf();
      if (e === t || e != e && t != t) {
        return true;
      }
      if (!e || !t) {
        return false;
      }
    }
    return typeof e.equals == "function" && typeof t.equals == "function" && !!e.equals(t);
  }
  function me(e, t) {
    if (e === t) {
      return true;
    }
    if (!a(t) || e.size !== undefined && t.size !== undefined && e.size !== t.size || e.__hash !== undefined && t.__hash !== undefined && e.__hash !== t.__hash || s(e) !== s(t) || l(e) !== l(t) || c(e) !== c(t)) {
      return false;
    }
    if (e.size === 0 && t.size === 0) {
      return true;
    }
    var n = !u(e);
    if (c(e)) {
      var r = e.entries();
      return t.every(function (e, t) {
        var i = r.next().value;
        return i && he(i[1], e) && (n || he(i[0], t));
      }) && r.next().done;
    }
    var i = false;
    if (e.size === undefined) {
      if (t.size === undefined) {
        if (typeof e.cacheResult == "function") {
          e.cacheResult();
        }
      } else {
        i = true;
        var o = e;
        e = t;
        t = o;
      }
    }
    var d = true;
    var f = t.__iterate(function (t, r) {
      if (n ? !e.has(t) : i ? !he(t, e.get(r, v)) : !he(e.get(r, v), t)) {
        d = false;
        return false;
      }
    });
    return d && e.size === f;
  }
  function ye(e, t) {
    if (!(this instanceof ye)) {
      return new ye(e, t);
    }
    this._value = e;
    this.size = t === undefined ? Infinity : Math.max(0, t);
    if (this.size === 0) {
      if (Z) {
        return Z;
      }
      Z = this;
    }
  }
  function ge(e, t) {
    if (!e) {
      throw new Error(t);
    }
  }
  function ve(e, t, n) {
    if (!(this instanceof ve)) {
      return new ve(e, t, n);
    }
    ge(n !== 0, "Cannot step a Range by 0");
    e = e || 0;
    if (t === undefined) {
      t = Infinity;
    }
    n = n === undefined ? 1 : Math.abs(n);
    if (t < e) {
      n = -n;
    }
    this._start = e;
    this._end = t;
    this._step = n;
    this.size = Math.max(0, Math.ceil((t - e) / n - 1) + 1);
    if (this.size === 0) {
      if (J) {
        return J;
      }
      J = this;
    }
  }
  function be() {
    throw TypeError("Abstract");
  }
  function _e() {}
  function we() {}
  function xe() {}
  G.prototype[Q] = true;
  t(ee, Y);
  ee.prototype.get = function (e, t) {
    if (this.has(e)) {
      return this._array[k(this, e)];
    } else {
      return t;
    }
  };
  ee.prototype.__iterate = function (e, t) {
    var n = this._array;
    for (var r = n.length - 1, i = 0; i <= r; i++) {
      if (e(n[t ? r - i : i], i, this) === false) {
        return i + 1;
      }
    }
    return i;
  };
  ee.prototype.__iterator = function (e, t) {
    var n = this._array;
    var r = n.length - 1;
    var i = 0;
    return new F(function () {
      if (i > r) {
        return {
          value: undefined,
          done: true
        };
      } else {
        return B(e, i, n[t ? r - i++ : i++]);
      }
    });
  };
  t(te, K);
  te.prototype.get = function (e, t) {
    if (t === undefined || this.has(e)) {
      return this._object[e];
    } else {
      return t;
    }
  };
  te.prototype.has = function (e) {
    return this._object.hasOwnProperty(e);
  };
  te.prototype.__iterate = function (e, t) {
    var n = this._object;
    var r = this._keys;
    for (var i = r.length - 1, o = 0; o <= i; o++) {
      var a = r[t ? i - o : o];
      if (e(n[a], a, this) === false) {
        return o + 1;
      }
    }
    return o;
  };
  te.prototype.__iterator = function (e, t) {
    var n = this._object;
    var r = this._keys;
    var i = r.length - 1;
    var o = 0;
    return new F(function () {
      var a = r[t ? i - o : o];
      if (o++ > i) {
        return {
          value: undefined,
          done: true
        };
      } else {
        return B(e, a, n[a]);
      }
    });
  };
  te.prototype[h] = true;
  t(ne, Y);
  ne.prototype.__iterateUncached = function (e, t) {
    if (t) {
      return this.cacheResult().__iterate(e, t);
    }
    var n = this._iterable;
    var r = V(n);
    var i = 0;
    if (H(r)) {
      for (var o; !(o = r.next()).done && e(o.value, i++, this) !== false;);
    }
    return i;
  };
  ne.prototype.__iteratorUncached = function (e, t) {
    if (t) {
      return this.cacheResult().__iterator(e, t);
    }
    var n = this._iterable;
    var r = V(n);
    if (!H(r)) {
      return new F(U);
    }
    var i = 0;
    return new F(function () {
      var t = r.next();
      if (t.done) {
        return t;
      } else {
        return B(e, i++, t.value);
      }
    });
  };
  t(re, Y);
  re.prototype.__iterateUncached = function (e, t) {
    if (t) {
      return this.cacheResult().__iterate(e, t);
    }
    var n;
    var r = this._iterator;
    for (var i = this._iteratorCache, o = 0; o < i.length;) {
      if (e(i[o], o++, this) === false) {
        return o;
      }
    }
    while (!(n = r.next()).done) {
      var a = n.value;
      i[o] = a;
      if (e(a, o++, this) === false) {
        break;
      }
    }
    return o;
  };
  re.prototype.__iteratorUncached = function (e, t) {
    if (t) {
      return this.cacheResult().__iterator(e, t);
    }
    var n = this._iterator;
    var r = this._iteratorCache;
    var i = 0;
    return new F(function () {
      if (i >= r.length) {
        var t = n.next();
        if (t.done) {
          return t;
        }
        r[i] = t.value;
      }
      return B(e, i, r[i++]);
    });
  };
  t(ye, Y);
  ye.prototype.toString = function () {
    if (this.size === 0) {
      return "Repeat []";
    } else {
      return "Repeat [ " + this._value + " " + this.size + " times ]";
    }
  };
  ye.prototype.get = function (e, t) {
    if (this.has(e)) {
      return this._value;
    } else {
      return t;
    }
  };
  ye.prototype.includes = function (e) {
    return he(this._value, e);
  };
  ye.prototype.slice = function (e, t) {
    var n = this.size;
    if (P(e, t, n)) {
      return this;
    } else {
      return new ye(this._value, I(t, n) - C(e, n));
    }
  };
  ye.prototype.reverse = function () {
    return this;
  };
  ye.prototype.indexOf = function (e) {
    if (he(this._value, e)) {
      return 0;
    } else {
      return -1;
    }
  };
  ye.prototype.lastIndexOf = function (e) {
    if (he(this._value, e)) {
      return this.size;
    } else {
      return -1;
    }
  };
  ye.prototype.__iterate = function (e, t) {
    for (var n = 0; n < this.size; n++) {
      if (e(this._value, n, this) === false) {
        return n + 1;
      }
    }
    return n;
  };
  ye.prototype.__iterator = function (e, t) {
    var n = this;
    var r = 0;
    return new F(function () {
      if (r < n.size) {
        return B(e, r++, n._value);
      } else {
        return {
          value: undefined,
          done: true
        };
      }
    });
  };
  ye.prototype.equals = function (e) {
    if (e instanceof ye) {
      return he(this._value, e._value);
    } else {
      return me(e);
    }
  };
  t(ve, Y);
  ve.prototype.toString = function () {
    if (this.size === 0) {
      return "Range []";
    } else {
      return "Range [ " + this._start + "..." + this._end + (this._step !== 1 ? " by " + this._step : "") + " ]";
    }
  };
  ve.prototype.get = function (e, t) {
    if (this.has(e)) {
      return this._start + k(this, e) * this._step;
    } else {
      return t;
    }
  };
  ve.prototype.includes = function (e) {
    var t = (e - this._start) / this._step;
    return t >= 0 && t < this.size && t === Math.floor(t);
  };
  ve.prototype.slice = function (e, t) {
    if (P(e, t, this.size)) {
      return this;
    } else {
      e = C(e, this.size);
      if ((t = I(t, this.size)) <= e) {
        return new ve(0, 0);
      } else {
        return new ve(this.get(e, this._end), this.get(t, this._end), this._step);
      }
    }
  };
  ve.prototype.indexOf = function (e) {
    var t = e - this._start;
    if (t % this._step == 0) {
      var n = t / this._step;
      if (n >= 0 && n < this.size) {
        return n;
      }
    }
    return -1;
  };
  ve.prototype.lastIndexOf = function (e) {
    return this.indexOf(e);
  };
  ve.prototype.__iterate = function (e, t) {
    for (var n = this.size - 1, r = this._step, i = t ? this._start + n * r : this._start, o = 0; o <= n; o++) {
      if (e(i, o, this) === false) {
        return o + 1;
      }
      i += t ? -r : r;
    }
    return o;
  };
  ve.prototype.__iterator = function (e, t) {
    var n = this.size - 1;
    var r = this._step;
    var i = t ? this._start + n * r : this._start;
    var o = 0;
    return new F(function () {
      var a = i;
      i += t ? -r : r;
      if (o > n) {
        return {
          value: undefined,
          done: true
        };
      } else {
        return B(e, o++, a);
      }
    });
  };
  ve.prototype.equals = function (e) {
    if (e instanceof ve) {
      return this._start === e._start && this._end === e._end && this._step === e._step;
    } else {
      return me(this, e);
    }
  };
  t(be, n);
  t(_e, be);
  t(we, be);
  t(xe, be);
  be.Keyed = _e;
  be.Indexed = we;
  be.Set = xe;
  var Ee = typeof Math.imul == "function" && Math.imul(4294967295, 2) === -2 ? Math.imul : function (e, t) {
    var n = (e |= 0) & 65535;
    var r = (t |= 0) & 65535;
    return n * r + ((e >>> 16) * r + n * (t >>> 16) << 16 >>> 0) | 0;
  };
  function Se(e) {
    return e >>> 1 & 1073741824 | e & -1073741825;
  }
  function Te(e) {
    if (e === false || e === null || e === undefined) {
      return 0;
    }
    if (typeof e.valueOf == "function" && ((e = e.valueOf()) === false || e === null || e === undefined)) {
      return 0;
    }
    if (e === true) {
      return 1;
    }
    var t;
    var n;
    var r = typeof e;
    if (r === "number") {
      if (e != e || e === Infinity) {
        return 0;
      }
      var i = e | 0;
      for (i !== e && (i ^= e * 4294967295); e > 4294967295;) {
        i ^= e /= 4294967295;
      }
      return Se(i);
    }
    if (r === "string") {
      if (e.length > Re) {
        if ((n = Ne[t = e]) === undefined) {
          n = ke(t);
          if (De === Ae) {
            De = 0;
            Ne = {};
          }
          De++;
          Ne[t] = n;
        }
        return n;
      } else {
        return ke(e);
      }
    }
    if (typeof e.hashCode == "function") {
      return e.hashCode();
    }
    if (r === "object") {
      return function (e) {
        var t;
        if (Ie && (t = Oe.get(e)) !== undefined) {
          return t;
        }
        if ((t = e[Le]) !== undefined) {
          return t;
        }
        if (!Ce) {
          if ((t = e.propertyIsEnumerable && e.propertyIsEnumerable[Le]) !== undefined) {
            return t;
          }
          if ((t = function (e) {
            if (e && e.nodeType > 0) {
              switch (e.nodeType) {
                case 1:
                  return e.uniqueID;
                case 9:
                  return e.documentElement && e.documentElement.uniqueID;
              }
            }
          }(e)) !== undefined) {
            return t;
          }
        }
        t = ++Me;
        if (Me & 1073741824) {
          Me = 0;
        }
        if (Ie) {
          Oe.set(e, t);
        } else {
          if (Pe !== undefined && Pe(e) === false) {
            throw new Error("Non-extensible objects are not allowed as keys.");
          }
          if (Ce) {
            Object.defineProperty(e, Le, {
              enumerable: false,
              configurable: false,
              writable: false,
              value: t
            });
          } else if (e.propertyIsEnumerable !== undefined && e.propertyIsEnumerable === e.constructor.prototype.propertyIsEnumerable) {
            e.propertyIsEnumerable = function () {
              return this.constructor.prototype.propertyIsEnumerable.apply(this, arguments);
            };
            e.propertyIsEnumerable[Le] = t;
          } else {
            if (e.nodeType === undefined) {
              throw new Error("Unable to set a non-enumerable property on object.");
            }
            e[Le] = t;
          }
        }
        return t;
      }(e);
    }
    if (typeof e.toString == "function") {
      return ke(e.toString());
    }
    throw new Error("Value type " + r + " cannot be hashed.");
  }
  function ke(e) {
    var t = 0;
    for (var n = 0; n < e.length; n++) {
      t = t * 31 + e.charCodeAt(n) | 0;
    }
    return Se(t);
  }
  var Oe;
  var Pe = Object.isExtensible;
  var Ce = function () {
    try {
      Object.defineProperty({}, "@", {});
      return true;
    } catch (e) {
      return false;
    }
  }();
  var Ie = typeof WeakMap == "function";
  if (Ie) {
    Oe = new WeakMap();
  }
  var Me = 0;
  var Le = "__immutablehash__";
  if (typeof Symbol == "function") {
    Le = Symbol(Le);
  }
  var Re = 16;
  var Ae = 255;
  var De = 0;
  var Ne = {};
  function je(e) {
    ge(e !== Infinity, "Cannot perform this action with an infinite size.");
  }
  function Fe(e) {
    if (e === null || e === undefined) {
      return Je();
    } else if (Be(e) && !c(e)) {
      return e;
    } else {
      return Je().withMutations(function (t) {
        var n = r(e);
        je(n.size);
        n.forEach(function (e, n) {
          return t.set(n, e);
        });
      });
    }
  }
  function Be(e) {
    return !!e && !!e[ze];
  }
  t(Fe, _e);
  Fe.of = function () {
    var t = e.call(arguments, 0);
    return Je().withMutations(function (e) {
      for (var n = 0; n < t.length; n += 2) {
        if (n + 1 >= t.length) {
          throw new Error("Missing value for key: " + t[n]);
        }
        e.set(t[n], t[n + 1]);
      }
    });
  };
  Fe.prototype.toString = function () {
    return this.__toString("Map {", "}");
  };
  Fe.prototype.get = function (e, t) {
    if (this._root) {
      return this._root.get(0, undefined, e, t);
    } else {
      return t;
    }
  };
  Fe.prototype.set = function (e, t) {
    return Qe(this, e, t);
  };
  Fe.prototype.setIn = function (e, t) {
    return this.updateIn(e, v, function () {
      return t;
    });
  };
  Fe.prototype.remove = function (e) {
    return Qe(this, e, v);
  };
  Fe.prototype.deleteIn = function (e) {
    return this.updateIn(e, function () {
      return v;
    });
  };
  Fe.prototype.update = function (e, t, n) {
    if (arguments.length === 1) {
      return e(this);
    } else {
      return this.updateIn([e], t, n);
    }
  };
  Fe.prototype.updateIn = function (e, t, n) {
    if (!n) {
      n = t;
      t = undefined;
    }
    var r = function e(t, n, r, i) {
      var o = t === v;
      var a = n.next();
      if (a.done) {
        var s = o ? r : t;
        var l = i(s);
        if (l === s) {
          return t;
        } else {
          return l;
        }
      }
      ge(o || t && t.set, "invalid keyPath");
      var u = a.value;
      var c = o ? v : t.get(u, v);
      var d = e(c, n, r, i);
      if (d === c) {
        return t;
      } else if (d === v) {
        return t.remove(u);
      } else {
        return (o ? Je() : t).set(u, d);
      }
    }(this, nn(e), t, n);
    if (r === v) {
      return undefined;
    } else {
      return r;
    }
  };
  Fe.prototype.clear = function () {
    if (this.size === 0) {
      return this;
    } else if (this.__ownerID) {
      this.size = 0;
      this._root = null;
      this.__hash = undefined;
      this.__altered = true;
      return this;
    } else {
      return Je();
    }
  };
  Fe.prototype.merge = function () {
    return rt(this, undefined, arguments);
  };
  Fe.prototype.mergeWith = function (t) {
    var n = e.call(arguments, 1);
    return rt(this, t, n);
  };
  Fe.prototype.mergeIn = function (t) {
    var n = e.call(arguments, 1);
    return this.updateIn(t, Je(), function (e) {
      if (typeof e.merge == "function") {
        return e.merge.apply(e, n);
      } else {
        return n[n.length - 1];
      }
    });
  };
  Fe.prototype.mergeDeep = function () {
    return rt(this, it, arguments);
  };
  Fe.prototype.mergeDeepWith = function (t) {
    var n = e.call(arguments, 1);
    return rt(this, ot(t), n);
  };
  Fe.prototype.mergeDeepIn = function (t) {
    var n = e.call(arguments, 1);
    return this.updateIn(t, Je(), function (e) {
      if (typeof e.mergeDeep == "function") {
        return e.mergeDeep.apply(e, n);
      } else {
        return n[n.length - 1];
      }
    });
  };
  Fe.prototype.sort = function (e) {
    return Ct(qt(this, e));
  };
  Fe.prototype.sortBy = function (e, t) {
    return Ct(qt(this, t, e));
  };
  Fe.prototype.withMutations = function (e) {
    var t = this.asMutable();
    e(t);
    if (t.wasAltered()) {
      return t.__ensureOwner(this.__ownerID);
    } else {
      return this;
    }
  };
  Fe.prototype.asMutable = function () {
    if (this.__ownerID) {
      return this;
    } else {
      return this.__ensureOwner(new E());
    }
  };
  Fe.prototype.asImmutable = function () {
    return this.__ensureOwner();
  };
  Fe.prototype.wasAltered = function () {
    return this.__altered;
  };
  Fe.prototype.__iterator = function (e, t) {
    return new Ye(this, e, t);
  };
  Fe.prototype.__iterate = function (e, t) {
    var n = this;
    var r = 0;
    if (this._root) {
      this._root.iterate(function (t) {
        r++;
        return e(t[1], t[0], n);
      }, t);
    }
    return r;
  };
  Fe.prototype.__ensureOwner = function (e) {
    if (e === this.__ownerID) {
      return this;
    } else if (e) {
      return Ze(this.size, this._root, e, this.__hash);
    } else {
      this.__ownerID = e;
      this.__altered = false;
      return this;
    }
  };
  Fe.isMap = Be;
  var Ue;
  var ze = "@@__IMMUTABLE_MAP__@@";
  var He = Fe.prototype;
  function Ve(e, t) {
    this.ownerID = e;
    this.entries = t;
  }
  function We(e, t, n) {
    this.ownerID = e;
    this.bitmap = t;
    this.nodes = n;
  }
  function qe(e, t, n) {
    this.ownerID = e;
    this.count = t;
    this.nodes = n;
  }
  function Ge(e, t, n) {
    this.ownerID = e;
    this.keyHash = t;
    this.entries = n;
  }
  function Ke(e, t, n) {
    this.ownerID = e;
    this.keyHash = t;
    this.entry = n;
  }
  function Ye(e, t, n) {
    this._type = t;
    this._reverse = n;
    this._stack = e._root && Xe(e._root);
  }
  function $e(e, t) {
    return B(e, t[0], t[1]);
  }
  function Xe(e, t) {
    return {
      node: e,
      index: 0,
      __prev: t
    };
  }
  function Ze(e, t, n, r) {
    var i = Object.create(He);
    i.size = e;
    i._root = t;
    i.__ownerID = n;
    i.__hash = r;
    i.__altered = false;
    return i;
  }
  function Je() {
    return Ue ||= Ze(0);
  }
  function Qe(e, t, n) {
    var r;
    var i;
    if (e._root) {
      var o = w(b);
      var a = w(_);
      r = et(e._root, e.__ownerID, 0, undefined, t, n, o, a);
      if (!a.value) {
        return e;
      }
      i = e.size + (o.value ? n === v ? -1 : 1 : 0);
    } else {
      if (n === v) {
        return e;
      }
      i = 1;
      r = new Ve(e.__ownerID, [[t, n]]);
    }
    if (e.__ownerID) {
      e.size = i;
      e._root = r;
      e.__hash = undefined;
      e.__altered = true;
      return e;
    } else if (r) {
      return Ze(i, r);
    } else {
      return Je();
    }
  }
  function et(e, t, n, r, i, o, a, s) {
    if (e) {
      return e.update(t, n, r, i, o, a, s);
    } else if (o === v) {
      return e;
    } else {
      x(s);
      x(a);
      return new Ke(t, r, [i, o]);
    }
  }
  function tt(e) {
    return e.constructor === Ke || e.constructor === Ge;
  }
  function nt(e, t, n, r, i) {
    if (e.keyHash === r) {
      return new Ge(t, r, [e.entry, i]);
    }
    var o;
    var a = (n === 0 ? e.keyHash : e.keyHash >>> n) & g;
    var s = (n === 0 ? r : r >>> n) & g;
    var l = a === s ? [nt(e, t, n + m, r, i)] : (o = new Ke(t, r, i), a < s ? [e, o] : [o, e]);
    return new We(t, 1 << a | 1 << s, l);
  }
  function rt(e, t, n) {
    var i = [];
    for (var o = 0; o < n.length; o++) {
      var s = n[o];
      var l = r(s);
      if (!a(s)) {
        l = l.map(function (e) {
          return de(e);
        });
      }
      i.push(l);
    }
    return at(e, t, i);
  }
  function it(e, t, n) {
    if (e && e.mergeDeep && a(t)) {
      return e.mergeDeep(t);
    } else if (he(e, t)) {
      return e;
    } else {
      return t;
    }
  }
  function ot(e) {
    return function (t, n, r) {
      if (t && t.mergeDeepWith && a(n)) {
        return t.mergeDeepWith(e, n);
      }
      var i = e(t, n, r);
      if (he(t, i)) {
        return t;
      } else {
        return i;
      }
    };
  }
  function at(e, t, n) {
    if ((n = n.filter(function (e) {
      return e.size !== 0;
    })).length === 0) {
      return e;
    } else if (e.size !== 0 || e.__ownerID || n.length !== 1) {
      return e.withMutations(function (e) {
        var r = t ? function (n, r) {
          e.update(r, v, function (e) {
            if (e === v) {
              return n;
            } else {
              return t(e, n, r);
            }
          });
        } : function (t, n) {
          e.set(n, t);
        };
        for (var i = 0; i < n.length; i++) {
          n[i].forEach(r);
        }
      });
    } else {
      return e.constructor(n[0]);
    }
  }
  function st(e) {
    e = (e = ((e -= e >> 1 & 1431655765) & 858993459) + (e >> 2 & 858993459)) + (e >> 4) & 252645135;
    e += e >> 8;
    return (e += e >> 16) & 127;
  }
  function lt(e, t, n, r) {
    var i = r ? e : S(e);
    i[t] = n;
    return i;
  }
  He[ze] = true;
  He.delete = He.remove;
  He.removeIn = He.deleteIn;
  Ve.prototype.get = function (e, t, n, r) {
    var i = this.entries;
    for (var o = 0, a = i.length; o < a; o++) {
      if (he(n, i[o][0])) {
        return i[o][1];
      }
    }
    return r;
  };
  Ve.prototype.update = function (e, t, n, r, i, o, a) {
    var s = i === v;
    for (var l = this.entries, u = 0, c = l.length; u < c && !he(r, l[u][0]); u++);
    var d = u < c;
    if (d ? l[u][1] === i : s) {
      return this;
    }
    x(a);
    if (s || !d) {
      x(o);
    }
    if (!s || l.length !== 1) {
      if (!d && !s && l.length >= ut) {
        return function (e, t, n, r) {
          e ||= new E();
          var i = new Ke(e, Te(n), [n, r]);
          for (var o = 0; o < t.length; o++) {
            var a = t[o];
            i = i.update(e, 0, undefined, a[0], a[1]);
          }
          return i;
        }(e, l, r, i);
      }
      var f = e && e === this.ownerID;
      var p = f ? l : S(l);
      if (d) {
        if (s) {
          if (u === c - 1) {
            p.pop();
          } else {
            p[u] = p.pop();
          }
        } else {
          p[u] = [r, i];
        }
      } else {
        p.push([r, i]);
      }
      if (f) {
        this.entries = p;
        return this;
      } else {
        return new Ve(e, p);
      }
    }
  };
  We.prototype.get = function (e, t = Te(n), n, r) {
    var i = 1 << ((e === 0 ? t : t >>> e) & g);
    var o = this.bitmap;
    if ((o & i) == 0) {
      return r;
    } else {
      return this.nodes[st(o & i - 1)].get(e + m, t, n, r);
    }
  };
  We.prototype.update = function (e, t, n = Te(r), r, i, o, a) {
    var s = (t === 0 ? n : n >>> t) & g;
    var l = 1 << s;
    var u = this.bitmap;
    var c = (u & l) != 0;
    if (!c && i === v) {
      return this;
    }
    var d = st(u & l - 1);
    var f = this.nodes;
    var p = c ? f[d] : undefined;
    var h = et(p, e, t + m, n, r, i, o, a);
    if (h === p) {
      return this;
    }
    if (!c && h && f.length >= ct) {
      return function (e, t, n, r, i) {
        var o = 0;
        var a = new Array(y);
        for (var s = 0; n !== 0; s++, n >>>= 1) {
          a[s] = n & 1 ? t[o++] : undefined;
        }
        a[r] = i;
        return new qe(e, o + 1, a);
      }(e, f, u, s, h);
    }
    if (c && !h && f.length === 2 && tt(f[d ^ 1])) {
      return f[d ^ 1];
    }
    if (c && h && f.length === 1 && tt(h)) {
      return h;
    }
    var b = e && e === this.ownerID;
    var _ = c ? h ? u : u ^ l : u | l;
    var w = c ? h ? lt(f, d, h, b) : function (e, t, n) {
      var r = e.length - 1;
      if (n && t === r) {
        e.pop();
        return e;
      }
      var i = new Array(r);
      var o = 0;
      for (var a = 0; a < r; a++) {
        if (a === t) {
          o = 1;
        }
        i[a] = e[a + o];
      }
      return i;
    }(f, d, b) : function (e, t, n, r) {
      var i = e.length + 1;
      if (r && t + 1 === i) {
        e[t] = n;
        return e;
      }
      var o = new Array(i);
      var a = 0;
      for (var s = 0; s < i; s++) {
        if (s === t) {
          o[s] = n;
          a = -1;
        } else {
          o[s] = e[s + a];
        }
      }
      return o;
    }(f, d, h, b);
    if (b) {
      this.bitmap = _;
      this.nodes = w;
      return this;
    } else {
      return new We(e, _, w);
    }
  };
  qe.prototype.get = function (e, t = Te(n), n, r) {
    var i = (e === 0 ? t : t >>> e) & g;
    var o = this.nodes[i];
    if (o) {
      return o.get(e + m, t, n, r);
    } else {
      return r;
    }
  };
  qe.prototype.update = function (e, t, n = Te(r), r, i, o, a) {
    var s = (t === 0 ? n : n >>> t) & g;
    var l = i === v;
    var u = this.nodes;
    var c = u[s];
    if (l && !c) {
      return this;
    }
    var d = et(c, e, t + m, n, r, i, o, a);
    if (d === c) {
      return this;
    }
    var f = this.count;
    if (c) {
      if (!d && --f < dt) {
        return function (e, t, n, r) {
          var i = 0;
          var o = 0;
          var a = new Array(n);
          for (var s = 0, l = 1, u = t.length; s < u; s++, l <<= 1) {
            var c = t[s];
            if (c !== undefined && s !== r) {
              i |= l;
              a[o++] = c;
            }
          }
          return new We(e, i, a);
        }(e, u, f, s);
      }
    } else {
      f++;
    }
    var p = e && e === this.ownerID;
    var h = lt(u, s, d, p);
    if (p) {
      this.count = f;
      this.nodes = h;
      return this;
    } else {
      return new qe(e, f, h);
    }
  };
  Ge.prototype.get = function (e, t, n, r) {
    var i = this.entries;
    for (var o = 0, a = i.length; o < a; o++) {
      if (he(n, i[o][0])) {
        return i[o][1];
      }
    }
    return r;
  };
  Ge.prototype.update = function (e, t, n = Te(r), r, i, o, a) {
    var s = i === v;
    if (n !== this.keyHash) {
      if (s) {
        return this;
      } else {
        x(a);
        x(o);
        return nt(this, e, t, n, [r, i]);
      }
    }
    for (var l = this.entries, u = 0, c = l.length; u < c && !he(r, l[u][0]); u++);
    var d = u < c;
    if (d ? l[u][1] === i : s) {
      return this;
    }
    x(a);
    if (s || !d) {
      x(o);
    }
    if (s && c === 2) {
      return new Ke(e, this.keyHash, l[u ^ 1]);
    }
    var f = e && e === this.ownerID;
    var p = f ? l : S(l);
    if (d) {
      if (s) {
        if (u === c - 1) {
          p.pop();
        } else {
          p[u] = p.pop();
        }
      } else {
        p[u] = [r, i];
      }
    } else {
      p.push([r, i]);
    }
    if (f) {
      this.entries = p;
      return this;
    } else {
      return new Ge(e, this.keyHash, p);
    }
  };
  Ke.prototype.get = function (e, t, n, r) {
    if (he(n, this.entry[0])) {
      return this.entry[1];
    } else {
      return r;
    }
  };
  Ke.prototype.update = function (e, t, n, r, i, o, a) {
    var s = i === v;
    var l = he(r, this.entry[0]);
    if (l ? i === this.entry[1] : s) {
      return this;
    } else {
      x(a);
      if (s) {
        x(o);
        return;
      } else if (l) {
        if (e && e === this.ownerID) {
          this.entry[1] = i;
          return this;
        } else {
          return new Ke(e, this.keyHash, [r, i]);
        }
      } else {
        x(o);
        return nt(this, e, t, Te(r), [r, i]);
      }
    }
  };
  Ve.prototype.iterate = Ge.prototype.iterate = function (e, t) {
    var n = this.entries;
    for (var r = 0, i = n.length - 1; r <= i; r++) {
      if (e(n[t ? i - r : r]) === false) {
        return false;
      }
    }
  };
  We.prototype.iterate = qe.prototype.iterate = function (e, t) {
    var n = this.nodes;
    for (var r = 0, i = n.length - 1; r <= i; r++) {
      var o = n[t ? i - r : r];
      if (o && o.iterate(e, t) === false) {
        return false;
      }
    }
  };
  Ke.prototype.iterate = function (e, t) {
    return e(this.entry);
  };
  t(Ye, F);
  Ye.prototype.next = function () {
    var e = this._type;
    for (var t = this._stack; t;) {
      var n;
      var r = t.node;
      var i = t.index++;
      if (r.entry) {
        if (i === 0) {
          return $e(e, r.entry);
        }
      } else if (r.entries) {
        n = r.entries.length - 1;
        if (i <= n) {
          return $e(e, r.entries[this._reverse ? n - i : i]);
        }
      } else {
        n = r.nodes.length - 1;
        if (i <= n) {
          var o = r.nodes[this._reverse ? n - i : i];
          if (o) {
            if (o.entry) {
              return $e(e, o.entry);
            }
            t = this._stack = Xe(o, t);
          }
          continue;
        }
      }
      t = this._stack = this._stack.__prev;
    }
    return {
      value: undefined,
      done: true
    };
  };
  var ut = y / 4;
  var ct = y / 2;
  var dt = y / 4;
  function ft(e) {
    var t = xt();
    if (e === null || e === undefined) {
      return t;
    }
    if (pt(e)) {
      return e;
    }
    var n = i(e);
    var r = n.size;
    if (r === 0) {
      return t;
    } else {
      je(r);
      if (r > 0 && r < y) {
        return wt(0, r, m, null, new yt(n.toArray()));
      } else {
        return t.withMutations(function (e) {
          e.setSize(r);
          n.forEach(function (t, n) {
            return e.set(n, t);
          });
        });
      }
    }
  }
  function pt(e) {
    return !!e && !!e[ht];
  }
  t(ft, we);
  ft.of = function () {
    return this(arguments);
  };
  ft.prototype.toString = function () {
    return this.__toString("List [", "]");
  };
  ft.prototype.get = function (e, t) {
    if ((e = k(this, e)) >= 0 && e < this.size) {
      var n = Tt(this, e += this._origin);
      return n && n.array[e & g];
    }
    return t;
  };
  ft.prototype.set = function (e, t) {
    return function (e, t, n) {
      if ((t = k(e, t)) != t) {
        return e;
      }
      if (t >= e.size || t < 0) {
        return e.withMutations(function (e) {
          if (t < 0) {
            kt(e, t).set(0, n);
          } else {
            kt(e, 0, t + 1).set(t, n);
          }
        });
      }
      t += e._origin;
      var r = e._tail;
      var i = e._root;
      var o = w(_);
      if (t >= Pt(e._capacity)) {
        r = Et(r, e.__ownerID, 0, t, n, o);
      } else {
        i = Et(i, e.__ownerID, e._level, t, n, o);
      }
      if (o.value) {
        if (e.__ownerID) {
          e._root = i;
          e._tail = r;
          e.__hash = undefined;
          e.__altered = true;
          return e;
        } else {
          return wt(e._origin, e._capacity, e._level, i, r);
        }
      } else {
        return e;
      }
    }(this, e, t);
  };
  ft.prototype.remove = function (e) {
    if (this.has(e)) {
      if (e === 0) {
        return this.shift();
      } else if (e === this.size - 1) {
        return this.pop();
      } else {
        return this.splice(e, 1);
      }
    } else {
      return this;
    }
  };
  ft.prototype.insert = function (e, t) {
    return this.splice(e, 0, t);
  };
  ft.prototype.clear = function () {
    if (this.size === 0) {
      return this;
    } else if (this.__ownerID) {
      this.size = this._origin = this._capacity = 0;
      this._level = m;
      this._root = this._tail = null;
      this.__hash = undefined;
      this.__altered = true;
      return this;
    } else {
      return xt();
    }
  };
  ft.prototype.push = function () {
    var e = arguments;
    var t = this.size;
    return this.withMutations(function (n) {
      kt(n, 0, t + e.length);
      for (var r = 0; r < e.length; r++) {
        n.set(t + r, e[r]);
      }
    });
  };
  ft.prototype.pop = function () {
    return kt(this, 0, -1);
  };
  ft.prototype.unshift = function () {
    var e = arguments;
    return this.withMutations(function (t) {
      kt(t, -e.length);
      for (var n = 0; n < e.length; n++) {
        t.set(n, e[n]);
      }
    });
  };
  ft.prototype.shift = function () {
    return kt(this, 1);
  };
  ft.prototype.merge = function () {
    return Ot(this, undefined, arguments);
  };
  ft.prototype.mergeWith = function (t) {
    var n = e.call(arguments, 1);
    return Ot(this, t, n);
  };
  ft.prototype.mergeDeep = function () {
    return Ot(this, it, arguments);
  };
  ft.prototype.mergeDeepWith = function (t) {
    var n = e.call(arguments, 1);
    return Ot(this, ot(t), n);
  };
  ft.prototype.setSize = function (e) {
    return kt(this, 0, e);
  };
  ft.prototype.slice = function (e, t) {
    var n = this.size;
    if (P(e, t, n)) {
      return this;
    } else {
      return kt(this, C(e, n), I(t, n));
    }
  };
  ft.prototype.__iterator = function (e, t) {
    var n = 0;
    var r = _t(this, t);
    return new F(function () {
      var t = r();
      if (t === bt) {
        return {
          value: undefined,
          done: true
        };
      } else {
        return B(e, n++, t);
      }
    });
  };
  ft.prototype.__iterate = function (e, t) {
    for (var n, r = 0, i = _t(this, t); (n = i()) !== bt && e(n, r++, this) !== false;);
    return r;
  };
  ft.prototype.__ensureOwner = function (e) {
    if (e === this.__ownerID) {
      return this;
    } else if (e) {
      return wt(this._origin, this._capacity, this._level, this._root, this._tail, e, this.__hash);
    } else {
      this.__ownerID = e;
      return this;
    }
  };
  ft.isList = pt;
  var ht = "@@__IMMUTABLE_LIST__@@";
  var mt = ft.prototype;
  function yt(e, t) {
    this.array = e;
    this.ownerID = t;
  }
  mt[ht] = true;
  mt.delete = mt.remove;
  mt.setIn = He.setIn;
  mt.deleteIn = mt.removeIn = He.removeIn;
  mt.update = He.update;
  mt.updateIn = He.updateIn;
  mt.mergeIn = He.mergeIn;
  mt.mergeDeepIn = He.mergeDeepIn;
  mt.withMutations = He.withMutations;
  mt.asMutable = He.asMutable;
  mt.asImmutable = He.asImmutable;
  mt.wasAltered = He.wasAltered;
  yt.prototype.removeBefore = function (e, t, n) {
    if (n === t ? 1 << t : this.array.length === 0) {
      return this;
    }
    var r = n >>> t & g;
    if (r >= this.array.length) {
      return new yt([], e);
    }
    var i;
    var o = r === 0;
    if (t > 0) {
      var a = this.array[r];
      if ((i = a && a.removeBefore(e, t - m, n)) === a && o) {
        return this;
      }
    }
    if (o && !i) {
      return this;
    }
    var s = St(this, e);
    if (!o) {
      for (var l = 0; l < r; l++) {
        s.array[l] = undefined;
      }
    }
    if (i) {
      s.array[r] = i;
    }
    return s;
  };
  yt.prototype.removeAfter = function (e, t, n) {
    if (n === (t ? 1 << t : 0) || this.array.length === 0) {
      return this;
    }
    var r;
    var i = n - 1 >>> t & g;
    if (i >= this.array.length) {
      return this;
    }
    if (t > 0) {
      var o = this.array[i];
      if ((r = o && o.removeAfter(e, t - m, n)) === o && i === this.array.length - 1) {
        return this;
      }
    }
    var a = St(this, e);
    a.array.splice(i + 1);
    if (r) {
      a.array[i] = r;
    }
    return a;
  };
  var gt;
  var vt;
  var bt = {};
  function _t(e, t) {
    var n = e._origin;
    var r = e._capacity;
    var i = Pt(r);
    var o = e._tail;
    return a(e._root, e._level, 0);
    function a(e, s, l) {
      if (s === 0) {
        return function (e, a) {
          var s = a === i ? o && o.array : e && e.array;
          var l = a > n ? 0 : n - a;
          var u = r - a;
          if (u > y) {
            u = y;
          }
          return function () {
            if (l === u) {
              return bt;
            }
            var e = t ? --u : l++;
            return s && s[e];
          };
        }(e, l);
      } else {
        return function (e, i, o) {
          var s;
          var l = e && e.array;
          var u = o > n ? 0 : n - o >> i;
          var c = 1 + (r - o >> i);
          if (c > y) {
            c = y;
          }
          return function () {
            while (true) {
              if (s) {
                var e = s();
                if (e !== bt) {
                  return e;
                }
                s = null;
              }
              if (u === c) {
                return bt;
              }
              var n = t ? --c : u++;
              s = a(l && l[n], i - m, o + (n << i));
            }
          };
        }(e, s, l);
      }
    }
  }
  function wt(e, t, n, r, i, o, a) {
    var s = Object.create(mt);
    s.size = t - e;
    s._origin = e;
    s._capacity = t;
    s._level = n;
    s._root = r;
    s._tail = i;
    s.__ownerID = o;
    s.__hash = a;
    s.__altered = false;
    return s;
  }
  function xt() {
    return gt ||= wt(0, 0, m);
  }
  function Et(e, t, n, r, i, o) {
    var a;
    var s = r >>> n & g;
    var l = e && s < e.array.length;
    if (!l && i === undefined) {
      return e;
    }
    if (n > 0) {
      var u = e && e.array[s];
      var c = Et(u, t, n - m, r, i, o);
      if (c === u) {
        return e;
      } else {
        (a = St(e, t)).array[s] = c;
        return a;
      }
    }
    if (l && e.array[s] === i) {
      return e;
    } else {
      x(o);
      a = St(e, t);
      if (i === undefined && s === a.array.length - 1) {
        a.array.pop();
      } else {
        a.array[s] = i;
      }
      return a;
    }
  }
  function St(e, t) {
    if (t && e && t === e.ownerID) {
      return e;
    } else {
      return new yt(e ? e.array.slice() : [], t);
    }
  }
  function Tt(e, t) {
    if (t >= Pt(e._capacity)) {
      return e._tail;
    }
    if (t < 1 << e._level + m) {
      for (var n = e._root, r = e._level; n && r > 0;) {
        n = n.array[t >>> r & g];
        r -= m;
      }
      return n;
    }
  }
  function kt(e, t, n) {
    if (t !== undefined) {
      t |= 0;
    }
    if (n !== undefined) {
      n |= 0;
    }
    var r = e.__ownerID || new E();
    var i = e._origin;
    var o = e._capacity;
    var a = i + t;
    var s = n === undefined ? o : n < 0 ? o + n : i + n;
    if (a === i && s === o) {
      return e;
    }
    if (a >= s) {
      return e.clear();
    }
    var l = e._level;
    var u = e._root;
    for (var c = 0; a + c < 0;) {
      u = new yt(u && u.array.length ? [undefined, u] : [], r);
      c += 1 << (l += m);
    }
    if (c) {
      a += c;
      i += c;
      s += c;
      o += c;
    }
    var d = Pt(o);
    for (var f = Pt(s); f >= 1 << l + m;) {
      u = new yt(u && u.array.length ? [u] : [], r);
      l += m;
    }
    var p = e._tail;
    var h = f < d ? Tt(e, s - 1) : f > d ? new yt([], r) : p;
    if (p && f > d && a < o && p.array.length) {
      var y = u = St(u, r);
      for (var v = l; v > m; v -= m) {
        var b = d >>> v & g;
        y = y.array[b] = St(y.array[b], r);
      }
      y.array[d >>> m & g] = p;
    }
    if (s < o) {
      h = h && h.removeAfter(r, 0, s);
    }
    if (a >= f) {
      a -= f;
      s -= f;
      l = m;
      u = null;
      h = h && h.removeBefore(r, 0, a);
    } else if (a > i || f < d) {
      for (c = 0; u;) {
        var _ = a >>> l & g;
        if (_ !== f >>> l & g) {
          break;
        }
        if (_) {
          c += (1 << l) * _;
        }
        l -= m;
        u = u.array[_];
      }
      if (u && a > i) {
        u = u.removeBefore(r, l, a - c);
      }
      if (u && f < d) {
        u = u.removeAfter(r, l, f - c);
      }
      if (c) {
        a -= c;
        s -= c;
      }
    }
    if (e.__ownerID) {
      e.size = s - a;
      e._origin = a;
      e._capacity = s;
      e._level = l;
      e._root = u;
      e._tail = h;
      e.__hash = undefined;
      e.__altered = true;
      return e;
    } else {
      return wt(a, s, l, u, h);
    }
  }
  function Ot(e, t, n) {
    var r = [];
    var o = 0;
    for (var s = 0; s < n.length; s++) {
      var l = n[s];
      var u = i(l);
      if (u.size > o) {
        o = u.size;
      }
      if (!a(l)) {
        u = u.map(function (e) {
          return de(e);
        });
      }
      r.push(u);
    }
    if (o > e.size) {
      e = e.setSize(o);
    }
    return at(e, t, r);
  }
  function Pt(e) {
    if (e < y) {
      return 0;
    } else {
      return e - 1 >>> m << m;
    }
  }
  function Ct(e) {
    if (e === null || e === undefined) {
      return Lt();
    } else if (It(e)) {
      return e;
    } else {
      return Lt().withMutations(function (t) {
        var n = r(e);
        je(n.size);
        n.forEach(function (e, n) {
          return t.set(n, e);
        });
      });
    }
  }
  function It(e) {
    return Be(e) && c(e);
  }
  function Mt(e, t, n, r) {
    var i = Object.create(Ct.prototype);
    i.size = e ? e.size : 0;
    i._map = e;
    i._list = t;
    i.__ownerID = n;
    i.__hash = r;
    return i;
  }
  function Lt() {
    return vt ||= Mt(Je(), xt());
  }
  function Rt(e, t, n) {
    var r;
    var i;
    var o = e._map;
    var a = e._list;
    var s = o.get(t);
    var l = s !== undefined;
    if (n === v) {
      if (!l) {
        return e;
      }
      if (a.size >= y && a.size >= o.size * 2) {
        i = a.filter(function (e, t) {
          return e !== undefined && s !== t;
        });
        r = i.toKeyedSeq().map(function (e) {
          return e[0];
        }).flip().toMap();
        if (e.__ownerID) {
          r.__ownerID = i.__ownerID = e.__ownerID;
        }
      } else {
        r = o.remove(t);
        i = s === a.size - 1 ? a.pop() : a.set(s, undefined);
      }
    } else if (l) {
      if (n === a.get(s)[1]) {
        return e;
      }
      r = o;
      i = a.set(s, [t, n]);
    } else {
      r = o.set(t, a.size);
      i = a.set(a.size, [t, n]);
    }
    if (e.__ownerID) {
      e.size = r.size;
      e._map = r;
      e._list = i;
      e.__hash = undefined;
      return e;
    } else {
      return Mt(r, i);
    }
  }
  function At(e, t) {
    this._iter = e;
    this._useKeys = t;
    this.size = e.size;
  }
  function Dt(e) {
    this._iter = e;
    this.size = e.size;
  }
  function Nt(e) {
    this._iter = e;
    this.size = e.size;
  }
  function jt(e) {
    this._iter = e;
    this.size = e.size;
  }
  function Ft(e) {
    var t = Qt(e);
    t._iter = e;
    t.size = e.size;
    t.flip = function () {
      return e;
    };
    t.reverse = function () {
      var t = e.reverse.apply(this);
      t.flip = function () {
        return e.reverse();
      };
      return t;
    };
    t.has = function (t) {
      return e.includes(t);
    };
    t.includes = function (t) {
      return e.has(t);
    };
    t.cacheResult = en;
    t.__iterateUncached = function (t, n) {
      var r = this;
      return e.__iterate(function (e, n) {
        return t(n, e, r) !== false;
      }, n);
    };
    t.__iteratorUncached = function (t, n) {
      if (t === A) {
        var r = e.__iterator(t, n);
        return new F(function () {
          var e = r.next();
          if (!e.done) {
            var t = e.value[0];
            e.value[0] = e.value[1];
            e.value[1] = t;
          }
          return e;
        });
      }
      return e.__iterator(t === R ? L : R, n);
    };
    return t;
  }
  function Bt(e, t, n) {
    var r = Qt(e);
    r.size = e.size;
    r.has = function (t) {
      return e.has(t);
    };
    r.get = function (r, i) {
      var o = e.get(r, v);
      if (o === v) {
        return i;
      } else {
        return t.call(n, o, r, e);
      }
    };
    r.__iterateUncached = function (r, i) {
      var o = this;
      return e.__iterate(function (e, i, a) {
        return r(t.call(n, e, i, a), i, o) !== false;
      }, i);
    };
    r.__iteratorUncached = function (r, i) {
      var o = e.__iterator(A, i);
      return new F(function () {
        var i = o.next();
        if (i.done) {
          return i;
        }
        var a = i.value;
        var s = a[0];
        return B(r, s, t.call(n, a[1], s, e), i);
      });
    };
    return r;
  }
  function Ut(e, t) {
    var n = Qt(e);
    n._iter = e;
    n.size = e.size;
    n.reverse = function () {
      return e;
    };
    if (e.flip) {
      n.flip = function () {
        var t = Ft(e);
        t.reverse = function () {
          return e.flip();
        };
        return t;
      };
    }
    n.get = function (n, r) {
      return e.get(t ? n : -1 - n, r);
    };
    n.has = function (n) {
      return e.has(t ? n : -1 - n);
    };
    n.includes = function (t) {
      return e.includes(t);
    };
    n.cacheResult = en;
    n.__iterate = function (t, n) {
      var r = this;
      return e.__iterate(function (e, n) {
        return t(e, n, r);
      }, !n);
    };
    n.__iterator = function (t, n) {
      return e.__iterator(t, !n);
    };
    return n;
  }
  function zt(e, t, n, r) {
    var i = Qt(e);
    if (r) {
      i.has = function (r) {
        var i = e.get(r, v);
        return i !== v && !!t.call(n, i, r, e);
      };
      i.get = function (r, i) {
        var o = e.get(r, v);
        if (o !== v && t.call(n, o, r, e)) {
          return o;
        } else {
          return i;
        }
      };
    }
    i.__iterateUncached = function (i, o) {
      var a = this;
      var s = 0;
      e.__iterate(function (e, o, l) {
        if (t.call(n, e, o, l)) {
          s++;
          return i(e, r ? o : s - 1, a);
        }
      }, o);
      return s;
    };
    i.__iteratorUncached = function (i, o) {
      var a = e.__iterator(A, o);
      var s = 0;
      return new F(function () {
        while (true) {
          var o = a.next();
          if (o.done) {
            return o;
          }
          var l = o.value;
          var u = l[0];
          var c = l[1];
          if (t.call(n, c, u, e)) {
            return B(i, r ? u : s++, c, o);
          }
        }
      });
    };
    return i;
  }
  function Ht(e, t, n, r) {
    var i = e.size;
    if (t !== undefined) {
      t |= 0;
    }
    if (n !== undefined) {
      if (n === Infinity) {
        n = i;
      } else {
        n |= 0;
      }
    }
    if (P(t, n, i)) {
      return e;
    }
    var o = C(t, i);
    var a = I(n, i);
    if (o != o || a != a) {
      return Ht(e.toSeq().cacheResult(), t, n, r);
    }
    var s;
    var l = a - o;
    if (l == l) {
      s = l < 0 ? 0 : l;
    }
    var u = Qt(e);
    u.size = s === 0 ? s : e.size && s || undefined;
    if (!r && ie(e) && s >= 0) {
      u.get = function (t, n) {
        if ((t = k(this, t)) >= 0 && t < s) {
          return e.get(t + o, n);
        } else {
          return n;
        }
      };
    }
    u.__iterateUncached = function (t, n) {
      var i = this;
      if (s === 0) {
        return 0;
      }
      if (n) {
        return this.cacheResult().__iterate(t, n);
      }
      var a = 0;
      var l = true;
      var u = 0;
      e.__iterate(function (e, n) {
        if (!l || !(l = a++ < o)) {
          u++;
          return t(e, r ? n : u - 1, i) !== false && u !== s;
        }
      });
      return u;
    };
    u.__iteratorUncached = function (t, n) {
      if (s !== 0 && n) {
        return this.cacheResult().__iterator(t, n);
      }
      var i = s !== 0 && e.__iterator(t, n);
      var a = 0;
      var l = 0;
      return new F(function () {
        while (a++ < o) {
          i.next();
        }
        if (++l > s) {
          return {
            value: undefined,
            done: true
          };
        }
        var e = i.next();
        if (r || t === R) {
          return e;
        } else {
          return B(t, l - 1, t === L ? undefined : e.value[1], e);
        }
      });
    };
    return u;
  }
  function Vt(e, t, n, r) {
    var i = Qt(e);
    i.__iterateUncached = function (i, o) {
      var a = this;
      if (o) {
        return this.cacheResult().__iterate(i, o);
      }
      var s = true;
      var l = 0;
      e.__iterate(function (e, o, u) {
        if (!s || !(s = t.call(n, e, o, u))) {
          l++;
          return i(e, r ? o : l - 1, a);
        }
      });
      return l;
    };
    i.__iteratorUncached = function (i, o) {
      var a = this;
      if (o) {
        return this.cacheResult().__iterator(i, o);
      }
      var s = e.__iterator(A, o);
      var l = true;
      var u = 0;
      return new F(function () {
        var e;
        var o;
        var c;
        do {
          if ((e = s.next()).done) {
            if (r || i === R) {
              return e;
            } else {
              return B(i, u++, i === L ? undefined : e.value[1], e);
            }
          }
          var d = e.value;
          o = d[0];
          c = d[1];
          l &&= t.call(n, c, o, a);
        } while (l);
        if (i === A) {
          return e;
        } else {
          return B(i, o, c, e);
        }
      });
    };
    return i;
  }
  function Wt(e, t, n) {
    var r = Qt(e);
    r.__iterateUncached = function (r, i) {
      var o = 0;
      var s = false;
      (function e(l, u) {
        var c = this;
        l.__iterate(function (i, l) {
          if ((!t || u < t) && a(i)) {
            e(i, u + 1);
          } else if (r(i, n ? l : o++, c) === false) {
            s = true;
          }
          return !s;
        }, i);
      })(e, 0);
      return o;
    };
    r.__iteratorUncached = function (r, i) {
      var o = e.__iterator(r, i);
      var s = [];
      var l = 0;
      return new F(function () {
        while (o) {
          var e = o.next();
          if (e.done === false) {
            var u = e.value;
            if (r === A) {
              u = u[1];
            }
            if (t && !(s.length < t) || !a(u)) {
              if (n) {
                return e;
              } else {
                return B(r, l++, u, e);
              }
            }
            s.push(o);
            o = u.__iterator(r, i);
          } else {
            o = s.pop();
          }
        }
        return {
          value: undefined,
          done: true
        };
      });
    };
    return r;
  }
  function qt(e, t, n) {
    t ||= tn;
    var r = s(e);
    var i = 0;
    var o = e.toSeq().map(function (t, r) {
      return [r, t, i++, n ? n(t, r, e) : t];
    }).toArray();
    o.sort(function (e, n) {
      return t(e[3], n[3]) || e[2] - n[2];
    }).forEach(r ? function (e, t) {
      o[t].length = 2;
    } : function (e, t) {
      o[t] = e[1];
    });
    if (r) {
      return K(o);
    } else if (l(e)) {
      return Y(o);
    } else {
      return $(o);
    }
  }
  function Gt(e, t, n) {
    t ||= tn;
    if (n) {
      var r = e.toSeq().map(function (t, r) {
        return [t, n(t, r, e)];
      }).reduce(function (e, n) {
        if (Kt(t, e[1], n[1])) {
          return n;
        } else {
          return e;
        }
      });
      return r && r[0];
    }
    return e.reduce(function (e, n) {
      if (Kt(t, e, n)) {
        return n;
      } else {
        return e;
      }
    });
  }
  function Kt(e, t, n) {
    var r = e(n, t);
    return r === 0 && n !== t && (n === undefined || n === null || n != n) || r > 0;
  }
  function Yt(e, t, r) {
    var i = Qt(e);
    i.size = new ee(r).map(function (e) {
      return e.size;
    }).min();
    i.__iterate = function (e, t) {
      for (var n, r = this.__iterator(R, t), i = 0; !(n = r.next()).done && e(n.value, i++, this) !== false;);
      return i;
    };
    i.__iteratorUncached = function (e, i) {
      var o = r.map(function (e) {
        e = n(e);
        return V(i ? e.reverse() : e);
      });
      var a = 0;
      var s = false;
      return new F(function () {
        var n;
        if (!s) {
          n = o.map(function (e) {
            return e.next();
          });
          s = n.some(function (e) {
            return e.done;
          });
        }
        if (s) {
          return {
            value: undefined,
            done: true
          };
        } else {
          return B(e, a++, t.apply(null, n.map(function (e) {
            return e.value;
          })));
        }
      });
    };
    return i;
  }
  function $t(e, t) {
    if (ie(e)) {
      return t;
    } else {
      return e.constructor(t);
    }
  }
  function Xt(e) {
    if (e !== Object(e)) {
      throw new TypeError("Expected [K, V] tuple: " + e);
    }
  }
  function Zt(e) {
    je(e.size);
    return T(e);
  }
  function Jt(e) {
    if (s(e)) {
      return r;
    } else if (l(e)) {
      return i;
    } else {
      return o;
    }
  }
  function Qt(e) {
    return Object.create((s(e) ? K : l(e) ? Y : $).prototype);
  }
  function en() {
    if (this._iter.cacheResult) {
      this._iter.cacheResult();
      this.size = this._iter.size;
      return this;
    } else {
      return G.prototype.cacheResult.call(this);
    }
  }
  function tn(e, t) {
    if (e > t) {
      return 1;
    } else if (e < t) {
      return -1;
    } else {
      return 0;
    }
  }
  function nn(e) {
    var t = V(e);
    if (!t) {
      if (!q(e)) {
        throw new TypeError("Expected iterable or array-like: " + e);
      }
      t = V(n(e));
    }
    return t;
  }
  function rn(e, t) {
    var n;
    function r(o) {
      if (o instanceof r) {
        return o;
      }
      if (!(this instanceof r)) {
        return new r(o);
      }
      if (!n) {
        n = true;
        var a = Object.keys(e);
        (function (e, t) {
          try {
            t.forEach(function (e, t) {
              Object.defineProperty(e, t, {
                get: function () {
                  return this.get(t);
                },
                set: function (e) {
                  ge(this.__ownerID, "Cannot set on an immutable record.");
                  this.set(t, e);
                }
              });
            }.bind(undefined, e));
          } catch (e) {}
        })(i, a);
        i.size = a.length;
        i._name = t;
        i._keys = a;
        i._defaultValues = e;
      }
      this._map = Fe(o);
    }
    var i = r.prototype = Object.create(on);
    i.constructor = r;
    return r;
  }
  t(Ct, Fe);
  Ct.of = function () {
    return this(arguments);
  };
  Ct.prototype.toString = function () {
    return this.__toString("OrderedMap {", "}");
  };
  Ct.prototype.get = function (e, t) {
    var n = this._map.get(e);
    if (n !== undefined) {
      return this._list.get(n)[1];
    } else {
      return t;
    }
  };
  Ct.prototype.clear = function () {
    if (this.size === 0) {
      return this;
    } else if (this.__ownerID) {
      this.size = 0;
      this._map.clear();
      this._list.clear();
      return this;
    } else {
      return Lt();
    }
  };
  Ct.prototype.set = function (e, t) {
    return Rt(this, e, t);
  };
  Ct.prototype.remove = function (e) {
    return Rt(this, e, v);
  };
  Ct.prototype.wasAltered = function () {
    return this._map.wasAltered() || this._list.wasAltered();
  };
  Ct.prototype.__iterate = function (e, t) {
    var n = this;
    return this._list.__iterate(function (t) {
      return t && e(t[1], t[0], n);
    }, t);
  };
  Ct.prototype.__iterator = function (e, t) {
    return this._list.fromEntrySeq().__iterator(e, t);
  };
  Ct.prototype.__ensureOwner = function (e) {
    if (e === this.__ownerID) {
      return this;
    }
    var t = this._map.__ensureOwner(e);
    var n = this._list.__ensureOwner(e);
    if (e) {
      return Mt(t, n, e, this.__hash);
    } else {
      this.__ownerID = e;
      this._map = t;
      this._list = n;
      return this;
    }
  };
  Ct.isOrderedMap = It;
  Ct.prototype[h] = true;
  Ct.prototype.delete = Ct.prototype.remove;
  t(At, K);
  At.prototype.get = function (e, t) {
    return this._iter.get(e, t);
  };
  At.prototype.has = function (e) {
    return this._iter.has(e);
  };
  At.prototype.valueSeq = function () {
    return this._iter.valueSeq();
  };
  At.prototype.reverse = function () {
    var e = this;
    var t = Ut(this, true);
    if (!this._useKeys) {
      t.valueSeq = function () {
        return e._iter.toSeq().reverse();
      };
    }
    return t;
  };
  At.prototype.map = function (e, t) {
    var n = this;
    var r = Bt(this, e, t);
    if (!this._useKeys) {
      r.valueSeq = function () {
        return n._iter.toSeq().map(e, t);
      };
    }
    return r;
  };
  At.prototype.__iterate = function (e, t) {
    var n;
    var r = this;
    return this._iter.__iterate(this._useKeys ? function (t, n) {
      return e(t, n, r);
    } : (n = t ? Zt(this) : 0, function (i) {
      return e(i, t ? --n : n++, r);
    }), t);
  };
  At.prototype.__iterator = function (e, t) {
    if (this._useKeys) {
      return this._iter.__iterator(e, t);
    }
    var n = this._iter.__iterator(R, t);
    var r = t ? Zt(this) : 0;
    return new F(function () {
      var i = n.next();
      if (i.done) {
        return i;
      } else {
        return B(e, t ? --r : r++, i.value, i);
      }
    });
  };
  At.prototype[h] = true;
  t(Dt, Y);
  Dt.prototype.includes = function (e) {
    return this._iter.includes(e);
  };
  Dt.prototype.__iterate = function (e, t) {
    var n = this;
    var r = 0;
    return this._iter.__iterate(function (t) {
      return e(t, r++, n);
    }, t);
  };
  Dt.prototype.__iterator = function (e, t) {
    var n = this._iter.__iterator(R, t);
    var r = 0;
    return new F(function () {
      var t = n.next();
      if (t.done) {
        return t;
      } else {
        return B(e, r++, t.value, t);
      }
    });
  };
  t(Nt, $);
  Nt.prototype.has = function (e) {
    return this._iter.includes(e);
  };
  Nt.prototype.__iterate = function (e, t) {
    var n = this;
    return this._iter.__iterate(function (t) {
      return e(t, t, n);
    }, t);
  };
  Nt.prototype.__iterator = function (e, t) {
    var n = this._iter.__iterator(R, t);
    return new F(function () {
      var t = n.next();
      if (t.done) {
        return t;
      } else {
        return B(e, t.value, t.value, t);
      }
    });
  };
  t(jt, K);
  jt.prototype.entrySeq = function () {
    return this._iter.toSeq();
  };
  jt.prototype.__iterate = function (e, t) {
    var n = this;
    return this._iter.__iterate(function (t) {
      if (t) {
        Xt(t);
        var r = a(t);
        return e(r ? t.get(1) : t[1], r ? t.get(0) : t[0], n);
      }
    }, t);
  };
  jt.prototype.__iterator = function (e, t) {
    var n = this._iter.__iterator(R, t);
    return new F(function () {
      while (true) {
        var t = n.next();
        if (t.done) {
          return t;
        }
        var r = t.value;
        if (r) {
          Xt(r);
          var i = a(r);
          return B(e, i ? r.get(0) : r[0], i ? r.get(1) : r[1], t);
        }
      }
    });
  };
  Dt.prototype.cacheResult = At.prototype.cacheResult = Nt.prototype.cacheResult = jt.prototype.cacheResult = en;
  t(rn, _e);
  rn.prototype.toString = function () {
    return this.__toString(sn(this) + " {", "}");
  };
  rn.prototype.has = function (e) {
    return this._defaultValues.hasOwnProperty(e);
  };
  rn.prototype.get = function (e, t) {
    if (!this.has(e)) {
      return t;
    }
    var n = this._defaultValues[e];
    if (this._map) {
      return this._map.get(e, n);
    } else {
      return n;
    }
  };
  rn.prototype.clear = function () {
    if (this.__ownerID) {
      if (this._map) {
        this._map.clear();
      }
      return this;
    }
    var e = this.constructor;
    return e._empty ||= an(this, Je());
  };
  rn.prototype.set = function (e, t) {
    if (!this.has(e)) {
      throw new Error("Cannot set unknown key \"" + e + "\" on " + sn(this));
    }
    if (this._map && !this._map.has(e)) {
      var n = this._defaultValues[e];
      if (t === n) {
        return this;
      }
    }
    var r = this._map && this._map.set(e, t);
    if (this.__ownerID || r === this._map) {
      return this;
    } else {
      return an(this, r);
    }
  };
  rn.prototype.remove = function (e) {
    if (!this.has(e)) {
      return this;
    }
    var t = this._map && this._map.remove(e);
    if (this.__ownerID || t === this._map) {
      return this;
    } else {
      return an(this, t);
    }
  };
  rn.prototype.wasAltered = function () {
    return this._map.wasAltered();
  };
  rn.prototype.__iterator = function (e, t) {
    var n = this;
    return r(this._defaultValues).map(function (e, t) {
      return n.get(t);
    }).__iterator(e, t);
  };
  rn.prototype.__iterate = function (e, t) {
    var n = this;
    return r(this._defaultValues).map(function (e, t) {
      return n.get(t);
    }).__iterate(e, t);
  };
  rn.prototype.__ensureOwner = function (e) {
    if (e === this.__ownerID) {
      return this;
    }
    var t = this._map && this._map.__ensureOwner(e);
    if (e) {
      return an(this, t, e);
    } else {
      this.__ownerID = e;
      this._map = t;
      return this;
    }
  };
  var on = rn.prototype;
  function an(e, t, n) {
    var r = Object.create(Object.getPrototypeOf(e));
    r._map = t;
    r.__ownerID = n;
    return r;
  }
  function sn(e) {
    return e._name || e.constructor.name || "Record";
  }
  function ln(e) {
    if (e === null || e === undefined) {
      return mn();
    } else if (un(e) && !c(e)) {
      return e;
    } else {
      return mn().withMutations(function (t) {
        var n = o(e);
        je(n.size);
        n.forEach(function (e) {
          return t.add(e);
        });
      });
    }
  }
  function un(e) {
    return !!e && !!e[dn];
  }
  on.delete = on.remove;
  on.deleteIn = on.removeIn = He.removeIn;
  on.merge = He.merge;
  on.mergeWith = He.mergeWith;
  on.mergeIn = He.mergeIn;
  on.mergeDeep = He.mergeDeep;
  on.mergeDeepWith = He.mergeDeepWith;
  on.mergeDeepIn = He.mergeDeepIn;
  on.setIn = He.setIn;
  on.update = He.update;
  on.updateIn = He.updateIn;
  on.withMutations = He.withMutations;
  on.asMutable = He.asMutable;
  on.asImmutable = He.asImmutable;
  t(ln, xe);
  ln.of = function () {
    return this(arguments);
  };
  ln.fromKeys = function (e) {
    return this(r(e).keySeq());
  };
  ln.prototype.toString = function () {
    return this.__toString("Set {", "}");
  };
  ln.prototype.has = function (e) {
    return this._map.has(e);
  };
  ln.prototype.add = function (e) {
    return pn(this, this._map.set(e, true));
  };
  ln.prototype.remove = function (e) {
    return pn(this, this._map.remove(e));
  };
  ln.prototype.clear = function () {
    return pn(this, this._map.clear());
  };
  ln.prototype.union = function () {
    var t = e.call(arguments, 0);
    if ((t = t.filter(function (e) {
      return e.size !== 0;
    })).length === 0) {
      return this;
    } else if (this.size !== 0 || this.__ownerID || t.length !== 1) {
      return this.withMutations(function (e) {
        for (var n = 0; n < t.length; n++) {
          o(t[n]).forEach(function (t) {
            return e.add(t);
          });
        }
      });
    } else {
      return this.constructor(t[0]);
    }
  };
  ln.prototype.intersect = function () {
    var t = e.call(arguments, 0);
    if (t.length === 0) {
      return this;
    }
    t = t.map(function (e) {
      return o(e);
    });
    var n = this;
    return this.withMutations(function (e) {
      n.forEach(function (n) {
        if (!t.every(function (e) {
          return e.includes(n);
        })) {
          e.remove(n);
        }
      });
    });
  };
  ln.prototype.subtract = function () {
    var t = e.call(arguments, 0);
    if (t.length === 0) {
      return this;
    }
    t = t.map(function (e) {
      return o(e);
    });
    var n = this;
    return this.withMutations(function (e) {
      n.forEach(function (n) {
        if (t.some(function (e) {
          return e.includes(n);
        })) {
          e.remove(n);
        }
      });
    });
  };
  ln.prototype.merge = function () {
    return this.union.apply(this, arguments);
  };
  ln.prototype.mergeWith = function (t) {
    var n = e.call(arguments, 1);
    return this.union.apply(this, n);
  };
  ln.prototype.sort = function (e) {
    return yn(qt(this, e));
  };
  ln.prototype.sortBy = function (e, t) {
    return yn(qt(this, t, e));
  };
  ln.prototype.wasAltered = function () {
    return this._map.wasAltered();
  };
  ln.prototype.__iterate = function (e, t) {
    var n = this;
    return this._map.__iterate(function (t, r) {
      return e(r, r, n);
    }, t);
  };
  ln.prototype.__iterator = function (e, t) {
    return this._map.map(function (e, t) {
      return t;
    }).__iterator(e, t);
  };
  ln.prototype.__ensureOwner = function (e) {
    if (e === this.__ownerID) {
      return this;
    }
    var t = this._map.__ensureOwner(e);
    if (e) {
      return this.__make(t, e);
    } else {
      this.__ownerID = e;
      this._map = t;
      return this;
    }
  };
  ln.isSet = un;
  var cn;
  var dn = "@@__IMMUTABLE_SET__@@";
  var fn = ln.prototype;
  function pn(e, t) {
    if (e.__ownerID) {
      e.size = t.size;
      e._map = t;
      return e;
    } else if (t === e._map) {
      return e;
    } else if (t.size === 0) {
      return e.__empty();
    } else {
      return e.__make(t);
    }
  }
  function hn(e, t) {
    var n = Object.create(fn);
    n.size = e ? e.size : 0;
    n._map = e;
    n.__ownerID = t;
    return n;
  }
  function mn() {
    return cn ||= hn(Je());
  }
  function yn(e) {
    if (e === null || e === undefined) {
      return wn();
    } else if (gn(e)) {
      return e;
    } else {
      return wn().withMutations(function (t) {
        var n = o(e);
        je(n.size);
        n.forEach(function (e) {
          return t.add(e);
        });
      });
    }
  }
  function gn(e) {
    return un(e) && c(e);
  }
  fn[dn] = true;
  fn.delete = fn.remove;
  fn.mergeDeep = fn.merge;
  fn.mergeDeepWith = fn.mergeWith;
  fn.withMutations = He.withMutations;
  fn.asMutable = He.asMutable;
  fn.asImmutable = He.asImmutable;
  fn.__empty = mn;
  fn.__make = hn;
  t(yn, ln);
  yn.of = function () {
    return this(arguments);
  };
  yn.fromKeys = function (e) {
    return this(r(e).keySeq());
  };
  yn.prototype.toString = function () {
    return this.__toString("OrderedSet {", "}");
  };
  yn.isOrderedSet = gn;
  var vn;
  var bn = yn.prototype;
  function _n(e, t) {
    var n = Object.create(bn);
    n.size = e ? e.size : 0;
    n._map = e;
    n.__ownerID = t;
    return n;
  }
  function wn() {
    return vn ||= _n(Lt());
  }
  function xn(e) {
    if (e === null || e === undefined) {
      return Pn();
    } else if (En(e)) {
      return e;
    } else {
      return Pn().unshiftAll(e);
    }
  }
  function En(e) {
    return !!e && !!e[Tn];
  }
  bn[h] = true;
  bn.__empty = wn;
  bn.__make = _n;
  t(xn, we);
  xn.of = function () {
    return this(arguments);
  };
  xn.prototype.toString = function () {
    return this.__toString("Stack [", "]");
  };
  xn.prototype.get = function (e, t) {
    var n = this._head;
    for (e = k(this, e); n && e--;) {
      n = n.next;
    }
    if (n) {
      return n.value;
    } else {
      return t;
    }
  };
  xn.prototype.peek = function () {
    return this._head && this._head.value;
  };
  xn.prototype.push = function () {
    if (arguments.length === 0) {
      return this;
    }
    var e = this.size + arguments.length;
    var t = this._head;
    for (var n = arguments.length - 1; n >= 0; n--) {
      t = {
        value: arguments[n],
        next: t
      };
    }
    if (this.__ownerID) {
      this.size = e;
      this._head = t;
      this.__hash = undefined;
      this.__altered = true;
      return this;
    } else {
      return On(e, t);
    }
  };
  xn.prototype.pushAll = function (e) {
    if ((e = i(e)).size === 0) {
      return this;
    }
    je(e.size);
    var t = this.size;
    var n = this._head;
    e.reverse().forEach(function (e) {
      t++;
      n = {
        value: e,
        next: n
      };
    });
    if (this.__ownerID) {
      this.size = t;
      this._head = n;
      this.__hash = undefined;
      this.__altered = true;
      return this;
    } else {
      return On(t, n);
    }
  };
  xn.prototype.pop = function () {
    return this.slice(1);
  };
  xn.prototype.unshift = function () {
    return this.push.apply(this, arguments);
  };
  xn.prototype.unshiftAll = function (e) {
    return this.pushAll(e);
  };
  xn.prototype.shift = function () {
    return this.pop.apply(this, arguments);
  };
  xn.prototype.clear = function () {
    if (this.size === 0) {
      return this;
    } else if (this.__ownerID) {
      this.size = 0;
      this._head = undefined;
      this.__hash = undefined;
      this.__altered = true;
      return this;
    } else {
      return Pn();
    }
  };
  xn.prototype.slice = function (e, t) {
    if (P(e, t, this.size)) {
      return this;
    }
    var n = C(e, this.size);
    var r = I(t, this.size);
    if (r !== this.size) {
      return we.prototype.slice.call(this, e, t);
    }
    var i = this.size - n;
    var o = this._head;
    while (n--) {
      o = o.next;
    }
    if (this.__ownerID) {
      this.size = i;
      this._head = o;
      this.__hash = undefined;
      this.__altered = true;
      return this;
    } else {
      return On(i, o);
    }
  };
  xn.prototype.__ensureOwner = function (e) {
    if (e === this.__ownerID) {
      return this;
    } else if (e) {
      return On(this.size, this._head, e, this.__hash);
    } else {
      this.__ownerID = e;
      this.__altered = false;
      return this;
    }
  };
  xn.prototype.__iterate = function (e, t) {
    if (t) {
      return this.reverse().__iterate(e);
    }
    for (var n = 0, r = this._head; r && e(r.value, n++, this) !== false;) {
      r = r.next;
    }
    return n;
  };
  xn.prototype.__iterator = function (e, t) {
    if (t) {
      return this.reverse().__iterator(e);
    }
    var n = 0;
    var r = this._head;
    return new F(function () {
      if (r) {
        var t = r.value;
        r = r.next;
        return B(e, n++, t);
      }
      return {
        value: undefined,
        done: true
      };
    });
  };
  xn.isStack = En;
  var Sn;
  var Tn = "@@__IMMUTABLE_STACK__@@";
  var kn = xn.prototype;
  function On(e, t, n, r) {
    var i = Object.create(kn);
    i.size = e;
    i._head = t;
    i.__ownerID = n;
    i.__hash = r;
    i.__altered = false;
    return i;
  }
  function Pn() {
    return Sn ||= On(0);
  }
  function Cn(e, t) {
    function n(n) {
      e.prototype[n] = t[n];
    }
    Object.keys(t).forEach(n);
    if (Object.getOwnPropertySymbols) {
      Object.getOwnPropertySymbols(t).forEach(n);
    }
    return e;
  }
  kn[Tn] = true;
  kn.withMutations = He.withMutations;
  kn.asMutable = He.asMutable;
  kn.asImmutable = He.asImmutable;
  kn.wasAltered = He.wasAltered;
  n.Iterator = F;
  Cn(n, {
    toArray: function () {
      je(this.size);
      var e = new Array(this.size || 0);
      this.valueSeq().__iterate(function (t, n) {
        e[n] = t;
      });
      return e;
    },
    toIndexedSeq: function () {
      return new Dt(this);
    },
    toJS: function () {
      return this.toSeq().map(function (e) {
        if (e && typeof e.toJS == "function") {
          return e.toJS();
        } else {
          return e;
        }
      }).__toJS();
    },
    toJSON: function () {
      return this.toSeq().map(function (e) {
        if (e && typeof e.toJSON == "function") {
          return e.toJSON();
        } else {
          return e;
        }
      }).__toJS();
    },
    toKeyedSeq: function () {
      return new At(this, true);
    },
    toMap: function () {
      return Fe(this.toKeyedSeq());
    },
    toObject: function () {
      je(this.size);
      var e = {};
      this.__iterate(function (t, n) {
        e[n] = t;
      });
      return e;
    },
    toOrderedMap: function () {
      return Ct(this.toKeyedSeq());
    },
    toOrderedSet: function () {
      return yn(s(this) ? this.valueSeq() : this);
    },
    toSet: function () {
      return ln(s(this) ? this.valueSeq() : this);
    },
    toSetSeq: function () {
      return new Nt(this);
    },
    toSeq: function () {
      if (l(this)) {
        return this.toIndexedSeq();
      } else if (s(this)) {
        return this.toKeyedSeq();
      } else {
        return this.toSetSeq();
      }
    },
    toStack: function () {
      return xn(s(this) ? this.valueSeq() : this);
    },
    toList: function () {
      return ft(s(this) ? this.valueSeq() : this);
    },
    toString: function () {
      return "[Iterable]";
    },
    __toString: function (e, t) {
      if (this.size === 0) {
        return e + t;
      } else {
        return e + " " + this.toSeq().map(this.__toStringMapper).join(", ") + " " + t;
      }
    },
    concat: function () {
      var t = e.call(arguments, 0);
      return $t(this, function (e, t) {
        var n = s(e);
        var i = [e].concat(t).map(function (e) {
          if (a(e)) {
            if (n) {
              e = r(e);
            }
          } else {
            e = n ? ae(e) : se(Array.isArray(e) ? e : [e]);
          }
          return e;
        }).filter(function (e) {
          return e.size !== 0;
        });
        if (i.length === 0) {
          return e;
        }
        if (i.length === 1) {
          var o = i[0];
          if (o === e || n && s(o) || l(e) && l(o)) {
            return o;
          }
        }
        var u = new ee(i);
        if (n) {
          u = u.toKeyedSeq();
        } else if (!l(e)) {
          u = u.toSetSeq();
        }
        (u = u.flatten(true)).size = i.reduce(function (e, t) {
          if (e !== undefined) {
            var n = t.size;
            if (n !== undefined) {
              return e + n;
            }
          }
        }, 0);
        return u;
      }(this, t));
    },
    includes: function (e) {
      return this.some(function (t) {
        return he(t, e);
      });
    },
    entries: function () {
      return this.__iterator(A);
    },
    every: function (e, t) {
      je(this.size);
      var n = true;
      this.__iterate(function (r, i, o) {
        if (!e.call(t, r, i, o)) {
          n = false;
          return false;
        }
      });
      return n;
    },
    filter: function (e, t) {
      return $t(this, zt(this, e, t, true));
    },
    find: function (e, t, n) {
      var r = this.findEntry(e, t);
      if (r) {
        return r[1];
      } else {
        return n;
      }
    },
    forEach: function (e, t) {
      je(this.size);
      return this.__iterate(t ? e.bind(t) : e);
    },
    join: function (e) {
      je(this.size);
      e = e !== undefined ? "" + e : ",";
      var t = "";
      var n = true;
      this.__iterate(function (r) {
        if (n) {
          n = false;
        } else {
          t += e;
        }
        t += r !== null && r !== undefined ? r.toString() : "";
      });
      return t;
    },
    keys: function () {
      return this.__iterator(L);
    },
    map: function (e, t) {
      return $t(this, Bt(this, e, t));
    },
    reduce: function (e, t, n) {
      var r;
      var i;
      je(this.size);
      if (arguments.length < 2) {
        i = true;
      } else {
        r = t;
      }
      this.__iterate(function (t, o, a) {
        if (i) {
          i = false;
          r = t;
        } else {
          r = e.call(n, r, t, o, a);
        }
      });
      return r;
    },
    reduceRight: function (e, t, n) {
      var r = this.toKeyedSeq().reverse();
      return r.reduce.apply(r, arguments);
    },
    reverse: function () {
      return $t(this, Ut(this, true));
    },
    slice: function (e, t) {
      return $t(this, Ht(this, e, t, true));
    },
    some: function (e, t) {
      return !this.every(An(e), t);
    },
    sort: function (e) {
      return $t(this, qt(this, e));
    },
    values: function () {
      return this.__iterator(R);
    },
    butLast: function () {
      return this.slice(0, -1);
    },
    isEmpty: function () {
      if (this.size !== undefined) {
        return this.size === 0;
      } else {
        return !this.some(function () {
          return true;
        });
      }
    },
    count: function (e, t) {
      return T(e ? this.toSeq().filter(e, t) : this);
    },
    countBy: function (e, t) {
      return function (e, t, n) {
        var r = Fe().asMutable();
        e.__iterate(function (i, o) {
          r.update(t.call(n, i, o, e), 0, function (e) {
            return e + 1;
          });
        });
        return r.asImmutable();
      }(this, e, t);
    },
    equals: function (e) {
      return me(this, e);
    },
    entrySeq: function () {
      var e = this;
      if (e._cache) {
        return new ee(e._cache);
      }
      var t = e.toSeq().map(Rn).toIndexedSeq();
      t.fromEntrySeq = function () {
        return e.toSeq();
      };
      return t;
    },
    filterNot: function (e, t) {
      return this.filter(An(e), t);
    },
    findEntry: function (e, t, n) {
      var r = n;
      this.__iterate(function (n, i, o) {
        if (e.call(t, n, i, o)) {
          r = [i, n];
          return false;
        }
      });
      return r;
    },
    findKey: function (e, t) {
      var n = this.findEntry(e, t);
      return n && n[0];
    },
    findLast: function (e, t, n) {
      return this.toKeyedSeq().reverse().find(e, t, n);
    },
    findLastEntry: function (e, t, n) {
      return this.toKeyedSeq().reverse().findEntry(e, t, n);
    },
    findLastKey: function (e, t) {
      return this.toKeyedSeq().reverse().findKey(e, t);
    },
    first: function () {
      return this.find(O);
    },
    flatMap: function (e, t) {
      return $t(this, function (e, t, n) {
        var r = Jt(e);
        return e.toSeq().map(function (i, o) {
          return r(t.call(n, i, o, e));
        }).flatten(true);
      }(this, e, t));
    },
    flatten: function (e) {
      return $t(this, Wt(this, e, true));
    },
    fromEntrySeq: function () {
      return new jt(this);
    },
    get: function (e, t) {
      return this.find(function (t, n) {
        return he(n, e);
      }, undefined, t);
    },
    getIn: function (e, t) {
      for (var n, r = this, i = nn(e); !(n = i.next()).done;) {
        var o = n.value;
        if ((r = r && r.get ? r.get(o, v) : v) === v) {
          return t;
        }
      }
      return r;
    },
    groupBy: function (e, t) {
      return function (e, t, n) {
        var r = s(e);
        var i = (c(e) ? Ct() : Fe()).asMutable();
        e.__iterate(function (o, a) {
          i.update(t.call(n, o, a, e), function (e) {
            (e = e || []).push(r ? [a, o] : o);
            return e;
          });
        });
        var o = Jt(e);
        return i.map(function (t) {
          return $t(e, o(t));
        });
      }(this, e, t);
    },
    has: function (e) {
      return this.get(e, v) !== v;
    },
    hasIn: function (e) {
      return this.getIn(e, v) !== v;
    },
    isSubset: function (e) {
      e = typeof e.includes == "function" ? e : n(e);
      return this.every(function (t) {
        return e.includes(t);
      });
    },
    isSuperset: function (e) {
      return (e = typeof e.isSubset == "function" ? e : n(e)).isSubset(this);
    },
    keyOf: function (e) {
      return this.findKey(function (t) {
        return he(t, e);
      });
    },
    keySeq: function () {
      return this.toSeq().map(Ln).toIndexedSeq();
    },
    last: function () {
      return this.toSeq().reverse().first();
    },
    lastKeyOf: function (e) {
      return this.toKeyedSeq().reverse().keyOf(e);
    },
    max: function (e) {
      return Gt(this, e);
    },
    maxBy: function (e, t) {
      return Gt(this, t, e);
    },
    min: function (e) {
      return Gt(this, e ? Dn(e) : Fn);
    },
    minBy: function (e, t) {
      return Gt(this, t ? Dn(t) : Fn, e);
    },
    rest: function () {
      return this.slice(1);
    },
    skip: function (e) {
      return this.slice(Math.max(0, e));
    },
    skipLast: function (e) {
      return $t(this, this.toSeq().reverse().skip(e).reverse());
    },
    skipWhile: function (e, t) {
      return $t(this, Vt(this, e, t, true));
    },
    skipUntil: function (e, t) {
      return this.skipWhile(An(e), t);
    },
    sortBy: function (e, t) {
      return $t(this, qt(this, t, e));
    },
    take: function (e) {
      return this.slice(0, Math.max(0, e));
    },
    takeLast: function (e) {
      return $t(this, this.toSeq().reverse().take(e).reverse());
    },
    takeWhile: function (e, t) {
      return $t(this, function (e, t, n) {
        var r = Qt(e);
        r.__iterateUncached = function (r, i) {
          var o = this;
          if (i) {
            return this.cacheResult().__iterate(r, i);
          }
          var a = 0;
          e.__iterate(function (e, i, s) {
            return t.call(n, e, i, s) && ++a && r(e, i, o);
          });
          return a;
        };
        r.__iteratorUncached = function (r, i) {
          var o = this;
          if (i) {
            return this.cacheResult().__iterator(r, i);
          }
          var a = e.__iterator(A, i);
          var s = true;
          return new F(function () {
            if (!s) {
              return {
                value: undefined,
                done: true
              };
            }
            var e = a.next();
            if (e.done) {
              return e;
            }
            var i = e.value;
            var l = i[0];
            var u = i[1];
            if (t.call(n, u, l, o)) {
              if (r === A) {
                return e;
              } else {
                return B(r, l, u, e);
              }
            } else {
              s = false;
              return {
                value: undefined,
                done: true
              };
            }
          });
        };
        return r;
      }(this, e, t));
    },
    takeUntil: function (e, t) {
      return this.takeWhile(An(e), t);
    },
    valueSeq: function () {
      return this.toIndexedSeq();
    },
    hashCode: function () {
      return this.__hash ||= function (e) {
        if (e.size === Infinity) {
          return 0;
        }
        var t = c(e);
        var n = s(e);
        var r = t ? 1 : 0;
        return function (e, t) {
          t = Ee(t, 3432918353);
          t = Ee(t << 15 | t >>> -15, 461845907);
          t = Ee(t << 13 | t >>> -13, 5);
          t = Ee((t = (t + 3864292196 | 0) ^ e) ^ t >>> 16, 2246822507);
          return t = Se((t = Ee(t ^ t >>> 13, 3266489909)) ^ t >>> 16);
        }(e.__iterate(n ? t ? function (e, t) {
          r = r * 31 + Bn(Te(e), Te(t)) | 0;
        } : function (e, t) {
          r = r + Bn(Te(e), Te(t)) | 0;
        } : t ? function (e) {
          r = r * 31 + Te(e) | 0;
        } : function (e) {
          r = r + Te(e) | 0;
        }), r);
      }(this);
    }
  });
  var In = n.prototype;
  In[d] = true;
  In[j] = In.values;
  In.__toJS = In.toArray;
  In.__toStringMapper = Nn;
  In.inspect = In.toSource = function () {
    return this.toString();
  };
  In.chain = In.flatMap;
  In.contains = In.includes;
  Cn(r, {
    flip: function () {
      return $t(this, Ft(this));
    },
    mapEntries: function (e, t) {
      var n = this;
      var r = 0;
      return $t(this, this.toSeq().map(function (i, o) {
        return e.call(t, [o, i], r++, n);
      }).fromEntrySeq());
    },
    mapKeys: function (e, t) {
      var n = this;
      return $t(this, this.toSeq().flip().map(function (r, i) {
        return e.call(t, r, i, n);
      }).flip());
    }
  });
  var Mn = r.prototype;
  function Ln(e, t) {
    return t;
  }
  function Rn(e, t) {
    return [t, e];
  }
  function An(e) {
    return function () {
      return !e.apply(this, arguments);
    };
  }
  function Dn(e) {
    return function () {
      return -e.apply(this, arguments);
    };
  }
  function Nn(e) {
    if (typeof e == "string") {
      return JSON.stringify(e);
    } else {
      return String(e);
    }
  }
  function jn() {
    return S(arguments);
  }
  function Fn(e, t) {
    if (e < t) {
      return 1;
    } else if (e > t) {
      return -1;
    } else {
      return 0;
    }
  }
  function Bn(e, t) {
    return e ^ t + 2654435769 + (e << 6) + (e >> 2) | 0;
  }
  Mn[f] = true;
  Mn[j] = In.entries;
  Mn.__toJS = In.toObject;
  Mn.__toStringMapper = function (e, t) {
    return JSON.stringify(t) + ": " + Nn(e);
  };
  Cn(i, {
    toKeyedSeq: function () {
      return new At(this, false);
    },
    filter: function (e, t) {
      return $t(this, zt(this, e, t, false));
    },
    findIndex: function (e, t) {
      var n = this.findEntry(e, t);
      if (n) {
        return n[0];
      } else {
        return -1;
      }
    },
    indexOf: function (e) {
      var t = this.keyOf(e);
      if (t === undefined) {
        return -1;
      } else {
        return t;
      }
    },
    lastIndexOf: function (e) {
      var t = this.lastKeyOf(e);
      if (t === undefined) {
        return -1;
      } else {
        return t;
      }
    },
    reverse: function () {
      return $t(this, Ut(this, false));
    },
    slice: function (e, t) {
      return $t(this, Ht(this, e, t, false));
    },
    splice: function (e, t) {
      var n = arguments.length;
      t = Math.max(t | 0, 0);
      if (n === 0 || n === 2 && !t) {
        return this;
      }
      e = C(e, e < 0 ? this.count() : this.size);
      var r = this.slice(0, e);
      return $t(this, n === 1 ? r : r.concat(S(arguments, 2), this.slice(e + t)));
    },
    findLastIndex: function (e, t) {
      var n = this.findLastEntry(e, t);
      if (n) {
        return n[0];
      } else {
        return -1;
      }
    },
    first: function () {
      return this.get(0);
    },
    flatten: function (e) {
      return $t(this, Wt(this, e, false));
    },
    get: function (e, t) {
      if ((e = k(this, e)) < 0 || this.size === Infinity || this.size !== undefined && e > this.size) {
        return t;
      } else {
        return this.find(function (t, n) {
          return n === e;
        }, undefined, t);
      }
    },
    has: function (e) {
      return (e = k(this, e)) >= 0 && (this.size !== undefined ? this.size === Infinity || e < this.size : this.indexOf(e) !== -1);
    },
    interpose: function (e) {
      return $t(this, function (e, t) {
        var n = Qt(e);
        n.size = e.size && e.size * 2 - 1;
        n.__iterateUncached = function (n, r) {
          var i = this;
          var o = 0;
          e.__iterate(function (e, r) {
            return (!o || n(t, o++, i) !== false) && n(e, o++, i) !== false;
          }, r);
          return o;
        };
        n.__iteratorUncached = function (n, r) {
          var i;
          var o = e.__iterator(R, r);
          var a = 0;
          return new F(function () {
            if ((!i || a % 2) && (i = o.next()).done) {
              return i;
            } else if (a % 2) {
              return B(n, a++, t);
            } else {
              return B(n, a++, i.value, i);
            }
          });
        };
        return n;
      }(this, e));
    },
    interleave: function () {
      var e = [this].concat(S(arguments));
      var t = Yt(this.toSeq(), Y.of, e);
      var n = t.flatten(true);
      if (t.size) {
        n.size = t.size * e.length;
      }
      return $t(this, n);
    },
    keySeq: function () {
      return ve(0, this.size);
    },
    last: function () {
      return this.get(-1);
    },
    skipWhile: function (e, t) {
      return $t(this, Vt(this, e, t, false));
    },
    zip: function () {
      return $t(this, Yt(this, jn, [this].concat(S(arguments))));
    },
    zipWith: function (e) {
      var t = S(arguments);
      t[0] = this;
      return $t(this, Yt(this, e, t));
    }
  });
  i.prototype[p] = true;
  i.prototype[h] = true;
  Cn(o, {
    get: function (e, t) {
      if (this.has(e)) {
        return e;
      } else {
        return t;
      }
    },
    includes: function (e) {
      return this.has(e);
    },
    keySeq: function () {
      return this.valueSeq();
    }
  });
  o.prototype.has = In.includes;
  o.prototype.contains = o.prototype.includes;
  Cn(K, r.prototype);
  Cn(Y, i.prototype);
  Cn($, o.prototype);
  Cn(_e, r.prototype);
  Cn(we, i.prototype);
  Cn(xe, o.prototype);
  return {
    Iterable: n,
    Seq: G,
    Collection: be,
    Map: Fe,
    OrderedMap: Ct,
    List: ft,
    Stack: xn,
    Set: ln,
    OrderedSet: yn,
    Record: rn,
    Range: ve,
    Repeat: ye,
    is: he,
    fromJS: de
  };
}();