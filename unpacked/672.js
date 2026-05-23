var r = require("./41.js");
var i = require("./28.js");
var o = require("./229.js");
var a = require("./72.js");
var s = require("./58.js");
var l = require("./330.js");
var u = require("./158.js");
var c = require("./331.js");
var d = require("./49.js");
var f = require("./157.js");
var p = require("./36.js").f;
var h = require("./673.js")(0);
var m = require("./42.js");
module.exports = function (e, t, n, y, g, v) {
  var b = r[e];
  var _ = b;
  var w = g ? "set" : "add";
  var x = _ && _.prototype;
  var E = {};
  if (m && typeof _ == "function" && (v || x.forEach && !a(function () {
    new _().entries().next();
  }))) {
    _ = t(function (t, n) {
      c(t, _, e, "_c");
      t._c = new b();
      if (n != undefined) {
        u(n, g, t[w], t);
      }
    });
    h("add,clear,delete,forEach,get,has,set,keys,values,entries,toJSON".split(","), function (e) {
      var t = e == "add" || e == "set";
      if (e in x && (!v || e != "clear")) {
        s(_.prototype, e, function (n, r) {
          c(this, _, e);
          if (!t && v && !d(n)) {
            return e == "get" && undefined;
          }
          var i = this._c[e](n === 0 ? 0 : n, r);
          if (t) {
            return this;
          } else {
            return i;
          }
        });
      }
    });
    if (!v) {
      p(_.prototype, "size", {
        get: function () {
          return this._c.size;
        }
      });
    }
  } else {
    _ = y.getConstructor(t, e, g, w);
    l(_.prototype, n);
    o.NEED = true;
  }
  f(_, e);
  E[e] = _;
  i(i.G + i.W + i.F, E);
  if (!v) {
    y.setStrong(_, e, g);
  }
  return _;
};