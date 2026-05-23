var r = require("./36.js").f;
var i = require("./156.js");
var o = require("./330.js");
var a = require("./70.js");
var s = require("./331.js");
var l = require("./158.js");
var u = require("./226.js");
var c = require("./325.js");
var d = require("./671.js");
var f = require("./42.js");
var p = require("./229.js").fastKey;
var h = require("./336.js");
var m = f ? "_s" : "size";
function y(e, t) {
  var n;
  var r = p(t);
  if (r !== "F") {
    return e._i[r];
  }
  for (n = e._f; n; n = n.n) {
    if (n.k == t) {
      return n;
    }
  }
}
module.exports = {
  getConstructor: function (e, t, n, u) {
    var c = e(function (e, r) {
      s(e, c, t, "_i");
      e._t = t;
      e._i = i(null);
      e._f = undefined;
      e._l = undefined;
      e[m] = 0;
      if (r != undefined) {
        l(r, n, e[u], e);
      }
    });
    o(c.prototype, {
      clear: function () {
        var e = h(this, t);
        var n = e._i;
        for (var r = e._f; r; r = r.n) {
          r.r = true;
          r.p &&= r.p.n = undefined;
          delete n[r.i];
        }
        e._f = e._l = undefined;
        e[m] = 0;
      },
      delete: function (e) {
        var n = h(this, t);
        var r = y(n, e);
        if (r) {
          var i = r.n;
          var o = r.p;
          delete n._i[r.i];
          r.r = true;
          if (o) {
            o.n = i;
          }
          if (i) {
            i.p = o;
          }
          if (n._f == r) {
            n._f = i;
          }
          if (n._l == r) {
            n._l = o;
          }
          n[m]--;
        }
        return !!r;
      },
      forEach: function (e) {
        h(this, t);
        for (var n, r = a(e, arguments.length > 1 ? arguments[1] : undefined, 3); n = n ? n.n : this._f;) {
          for (r(n.v, n.k, this); n && n.r;) {
            n = n.p;
          }
        }
      },
      has: function (e) {
        return !!y(h(this, t), e);
      }
    });
    if (f) {
      r(c.prototype, "size", {
        get: function () {
          return h(this, t)[m];
        }
      });
    }
    return c;
  },
  def: function (e, t, n) {
    var r;
    var i;
    var o = y(e, t);
    if (o) {
      o.v = n;
    } else {
      e._l = o = {
        i: i = p(t, true),
        k: t,
        v: n,
        p: r = e._l,
        n: undefined,
        r: false
      };
      e._f ||= o;
      if (r) {
        r.n = o;
      }
      e[m]++;
      if (i !== "F") {
        e._i[i] = o;
      }
    }
    return e;
  },
  getEntry: y,
  setStrong: function (e, t, n) {
    u(e, t, function (e, n) {
      this._t = h(e, t);
      this._k = n;
      this._l = undefined;
    }, function () {
      var e = this._k;
      for (var t = this._l; t && t.r;) {
        t = t.p;
      }
      if (this._t && (this._l = t = t ? t.n : this._t._f)) {
        return c(0, e == "keys" ? t.k : e == "values" ? t.v : [t.k, t.v]);
      } else {
        this._t = undefined;
        return c(1);
      }
    }, n ? "entries" : "values", !n, true);
    d(t);
  }
};