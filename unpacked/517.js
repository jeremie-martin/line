var r = function () {
  return function (e, t) {
    if (Array.isArray(e)) {
      return e;
    }
    if (Symbol.iterator in Object(e)) {
      return function (e, t) {
        var n = [];
        var r = true;
        var i = false;
        var o = undefined;
        try {
          for (var a, s = e[Symbol.iterator](); !(r = (a = s.next()).done) && (n.push(a.value), !t || n.length !== t); r = true);
        } catch (e) {
          i = true;
          o = e;
        } finally {
          try {
            if (!r && s.return) {
              s.return();
            }
          } finally {
            if (i) {
              throw o;
            }
          }
        }
        return n;
      }(e, t);
    }
    throw new TypeError("Invalid attempt to destructure non-iterable instance");
  };
}();
var i = require("./289.js");
function o(e) {
  this.map = e || null;
  this.patchSource = null;
  this.patch = null;
  this.root = {};
}
o.prototype.__getMap = function () {
  if (!this.map) {
    if (this.patchSource) {
      for (var e = this.patchSource, t = [this]; e.patchSource;) {
        t.push(e);
        e = e.patchSource;
      }
      while (t.length > 0) {
        var n = t.pop();
        n.patch.apply(e.map);
        e.patchSource = n;
        e.patch = n.patch.inverse();
        n.map = e.map;
        e.map = null;
        n.patchSource = null;
        e = n;
      }
    } else {
      this.map = new Map();
    }
  }
};
o.prototype.get = function (e) {
  this.__getMap();
  return this.map.get(e);
};
o.prototype.withKeySetToValue = function (e, t) {
  this.__getMap();
  var n = new o();
  n.map = this.map;
  this.map = null;
  this.patchSource = n;
  this.patch = new i.Set(e, t, n.map.get(e));
  n.map.set(e, t);
  return n;
};
o.prototype.withKeyDeleted = function (e) {
  this.__getMap();
  var t = new o();
  t.map = this.map;
  this.map = null;
  this.patchSource = t;
  this.patch = new i.Set(e, undefined, t.get(e));
  t.map.delete(e);
  return t;
};
o.prototype.withPatchApplied = function (e) {
  this.__getMap();
  var t = new o();
  this.patchSource = t;
  this.patch = e.inverse();
  t.map = this.map;
  this.map = null;
  e.apply(t.map);
  return t;
};
o.prototype.forEach = function (e) {
  this.__getMap();
  this.map.forEach(e);
};
o.prototype.toJS = function () {
  this.__getMap();
  return new Map(this.map);
};
o.prototype.toJSON = function () {
  this.__getMap();
  return [...this.map.entries()];
};
o.prototype.size = function () {
  this.__getMap();
  return this.map.size;
};
o.prototype.has = function (e) {
  this.__getMap();
  return this.map.has(e);
};
o.prototype.equals = function (e) {
  if (e == null) {
    return false;
  }
  if (!(e instanceof o)) {
    return false;
  }
  this.__getMap();
  const t = new Map(this.map);
  e.__getMap();
  return function (e, t) {
    var n;
    if (e.size !== t.size) {
      return false;
    }
    for (var i of e) {
      var o = r(i, 2);
      var a = o[0];
      var s = o[1];
      if ((n = t.get(a)) !== s || n === undefined && !t.has(a)) {
        return false;
      }
    }
    return true;
  }(t, e.map);
};
module.exports = o;