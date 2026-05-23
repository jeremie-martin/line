var r = require("./288.js");
var i = require("./201.js");
var o = require("./514.js");
function a(e) {
  this.buffer = e != null ? e.slice() : null;
  this.patchSource = null;
  this.patch = null;
  this.root = {};
}
function s(e) {
  var t = [];
  for (var n = e; !n.buffer;) {
    t.push(n.patch);
    n = n.patchSource;
  }
  t.reverse();
  if (t.length == 1) {
    return t[0];
  } else {
    return new i.Sequence(t);
  }
}
a.prototype.__getBuffer = function () {
  if (!this.buffer) {
    if (this.patchSource) {
      for (var e = this.patchSource, t = [this]; e.patchSource;) {
        t.push(e);
        e = e.patchSource;
      }
      while (t.length > 0) {
        var n = t.pop();
        n.patch.apply(e.buffer);
        e.patchSource = n;
        e.patch = n.patch.inverse();
        n.buffer = e.buffer;
        e.buffer = null;
        n.patchSource = null;
        e = n;
      }
    } else {
      this.buffer = [];
    }
  }
};
a.prototype.push = function (e) {
  this.__getBuffer();
  var t = new a();
  this.patchSource = t;
  this.patch = new i.Remove(this.buffer.length, e);
  t.buffer = this.buffer;
  this.buffer = null;
  t.buffer.push(e);
  t.root = this.root;
  return t;
};
a.prototype.withValueAdded = function (e, t) {
  this.__getBuffer();
  var n = new a();
  this.patchSource = n;
  this.patch = new i.Remove(e, t);
  n.buffer = this.buffer;
  this.buffer = null;
  n.buffer.splice(e, 0, t);
  n.root = this.root;
  return n;
};
a.prototype.withValueRemoved = function (e) {
  this.__getBuffer();
  var t = new a();
  this.patchSource = t;
  this.patch = new i.Add(e, this.buffer[e]);
  t.buffer = this.buffer;
  this.buffer = null;
  t.buffer.splice(e, 1);
  t.root = this.root;
  return t;
};
a.prototype.pop = function () {
  this.__getBuffer();
  var e = new a();
  this.patchSource = e;
  this.patch = new i.Add(this.buffer.length - 1, this.buffer[this.buffer.length - 1]);
  this.buffer.pop();
  e.buffer = this.buffer;
  this.buffer = null;
  e.root = this.root;
  return e;
};
a.prototype.size = function () {
  this.__getBuffer();
  return this.buffer.length;
};
a.prototype.get = function (e) {
  this.__getBuffer();
  return this.buffer[e];
};
a.prototype.set = function (e, t) {
  this.__getBuffer();
  var n = new a();
  this.patchSource = n;
  this.patch = new i.Sequence([new i.Remove(e, t), new i.Add(e, this.buffer[e])]);
  n.buffer = this.buffer;
  this.buffer = null;
  n.buffer[e] = t;
  n.root = this.root;
  return n;
};
a.prototype.forEach = function (e) {
  this.__getBuffer();
  let t = this.buffer.length;
  for (let n = 0; n < t; ++n) {
    this.__getBuffer();
    e(this.buffer[n], n);
  }
};
a.prototype[Symbol.iterator] = function* () {
  this.__getBuffer();
  let e = this.buffer.length;
  for (let t = 0; t < e; ++t) {
    this.__getBuffer();
    yield this.buffer[t];
  }
};
a.prototype.contains = function (e) {
  this.__getBuffer();
  return this.buffer.indexOf(e) >= 0;
};
a.prototype.containsAny = function () {
  this.__getBuffer();
  for (let e = 0; e < this.buffer.length; ++e) {
    for (let t = 0; t < arguments.length; ++t) {
      if (this.buffer[e] === arguments[t]) {
        return true;
      }
    }
  }
  return false;
};
a.prototype.toArray = function () {
  return this.toJS();
};
a.prototype.toJS = function () {
  this.__getBuffer();
  return this.buffer.slice();
};
a.prototype.toJSON = function () {
  return this.toJS();
};
a.prototype.findIndex = function (e) {
  this.__getBuffer();
  return this.buffer.findIndex(e);
};
a.prototype.findIndexWithBinarySearch = function (e, t) {
  this.__getBuffer();
  return r.findIndexWithBinarySearch(this.buffer, e, t);
};
a.prototype.findInsertionIndexWithBinarySearch = function (e, t) {
  this.__getBuffer();
  return r.findInsertionIndexWithBinarySearch(this.buffer, e, t);
};
a.prototype.withMutation = function (e, t) {
  return this.set(e, t(this.get(e)));
};
a.prototype.slice = function (e, t) {
  if (e === undefined || e === 0 && t === undefined) {
    return this;
  }
  this.__getBuffer();
  var n = new a();
  n.buffer = this.buffer.slice(e, t);
  return n;
};
a.prototype.filter = function (e) {
  var t;
  var n;
  var r;
  var o;
  var s;
  o = [];
  this.__getBuffer();
  t = 0;
  n = 0;
  for (; t < this.buffer.length; ++t) {
    if (e(s = this.buffer[t], t)) {
      this.buffer[n++] = s;
    } else {
      o.push(new i.Add(t, s));
    }
  }
  if (t === n) {
    return this;
  } else {
    this.buffer.splice(n);
    r = new a();
    this.patchSource = r;
    this.patch = new i.Sequence(o);
    r.buffer = this.buffer;
    this.buffer = null;
    r.root = this.root;
    return r;
  }
};
a.prototype.map = function (e) {
  var t;
  var n;
  var r;
  var o;
  var s;
  r = [];
  this.__getBuffer();
  t = 0;
  for (; t < this.buffer.length; ++t) {
    if ((s = e(o = this.buffer[t], t)) !== o) {
      r.push(new i.Replace(t, s, o));
      this.buffer[t] = s;
    }
  }
  if (r.length === 0) {
    return this;
  } else {
    n = new a();
    this.patchSource = n;
    this.patch = new i.Sequence(r);
    n.buffer = this.buffer;
    this.buffer = null;
    n.root = this.root;
    return n;
  }
};
a.prototype.splice = function (e, t) {
  var n;
  if (e === 0 && t === 0 && arguments.length === 2) {
    return this;
  }
  if (e === undefined) {
    e = 0;
  }
  var r = this.buffer.splice.apply(this.buffer, arguments);
  var o = [];
  for (n = 2; n < arguments.length; ++n) {
    o.push(new i.Remove(e, arguments[n]));
  }
  for (n = 0; n < r.length; ++n) {
    o.push(new i.Add(e + n, r[n]));
  }
  var s = new a();
  this.patchSource = s;
  this.patch = new i.Sequence(o);
  s.buffer = this.buffer;
  this.buffer = null;
  s.root = this.root;
  return s;
};
a.prototype.compareTo = function (e, t) {
  if (e.root == this.root) {
    if (e == this) {
      return new i.Sequence([]);
    } else if (this.buffer) {
      return s(e);
    } else if (e.buffer) {
      return s(this).inverse();
    } else {
      this.__getBuffer();
      return s(e);
    }
  } else {
    this.__getBuffer();
    e.__getBuffer();
    if (t && t.ordered) {
      return function (e, t, n) {
        var r;
        var o;
        var a;
        var s = [];
        r = 0;
        o = 0;
        a = 0;
        for (; r < e.length && o < t.length; ++a) {
          var l = n(e[r], t[o]);
          if (l == null) {
            s.push(new i.Remove(a, e[r]));
            s.push(new i.Add(a, t[o]));
            ++r;
            ++o;
          } else if (l == 0) {
            ++r;
            ++o;
          } else if (l < 0) {
            s.push(new i.Remove(a, e[r]));
            ++r;
            --a;
          } else {
            s.push(new i.Add(a, t[o]));
            ++o;
          }
        }
        if (r == e.length && o != t.length) {
          while (o < t.length) {
            s.push(new i.Add(a, t[o]));
            ++o;
            ++a;
          }
        } else if (r != e.length && o == t.length) {
          while (r < e.length) {
            s.push(new i.Remove(a, e[r]));
            ++r;
          }
        }
        return new i.Sequence(s);
      }(this.buffer, e.buffer, t.comparison);
    } else {
      return function (e, t) {
        var n;
        var r = [];
        for (n = e.length - 1; n >= 0; --n) {
          r.push(new i.Remove(n, e[n]));
        }
        for (n = 0; n < t.length; ++n) {
          r.push(new i.Add(n, t[n]));
        }
        return new i.Sequence(r);
      }(this.buffer, e.buffer);
    }
  }
};
a.prototype.withPatchApplied = function (e) {
  this.__getBuffer();
  var t = new a();
  this.patchSource = t;
  this.patch = e.inverse();
  t.buffer = this.buffer;
  this.buffer = null;
  e.apply(t.buffer);
  return t;
};
a.prototype.equals = function (e) {
  if (e == null) {
    return false;
  }
  if (!(e instanceof a)) {
    return false;
  }
  this.__getBuffer();
  const t = this.buffer.slice();
  e.__getBuffer();
  if (t.length !== e.buffer.length) {
    return false;
  }
  for (let n = 0; n < t.length; ++n) {
    if (t[n].equals && !t[n].equals(e.buffer[n])) {
      return false;
    }
    if (t[n] !== e.buffer[n]) {
      return false;
    }
  }
  return true;
};
a.prototype.deepEquals = function (e) {
  if (e == null) {
    return false;
  }
  if (!(e instanceof a)) {
    return false;
  }
  this.__getBuffer();
  const t = this.buffer.slice();
  e.__getBuffer();
  if (t.length !== e.buffer.length) {
    return false;
  }
  for (let n = 0; n < t.length; ++n) {
    if (t[n].deepEquals) {
      if (!t[n].deepEquals(e.buffer[n])) {
        return false;
      }
    } else if (t[n].equals) {
      if (!t[n].equals(e.buffer[n])) {
        return false;
      }
    } else if (!o(t[n], e.buffer[n])) {
      return false;
    }
  }
  return true;
};
module.exports = a;