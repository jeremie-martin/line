Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = Object.assign || function (e) {
  for (var t = 1; t < arguments.length; t++) {
    var n = arguments[t];
    for (var r in n) {
      if (Object.prototype.hasOwnProperty.call(n, r)) {
        e[r] = n[r];
      }
    }
  }
  return e;
};
var i = function () {
  function e(e, t) {
    for (var n = 0; n < t.length; n++) {
      var r = t[n];
      r.enumerable = r.enumerable || false;
      r.configurable = true;
      if ("value" in r) {
        r.writable = true;
      }
      Object.defineProperty(e, r.key, r);
    }
  }
  return function (t, n, r) {
    if (n) {
      e(t.prototype, n);
    }
    if (r) {
      e(t, r);
    }
    return t;
  };
}();
var o = u(require("./161.js"));
var a = u(require("./342.js"));
var s = u(require("./86.js"));
var l = u(require("./693.js"));
function u(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var c = function () {
  function e(t) {
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, e);
    this.map = {};
    this.raw = {};
    this.index = [];
    this.options = t;
    this.classes = t.classes;
  }
  i(e, [{
    key: "add",
    value: function (e, t, n) {
      var i = this.options;
      var a = i.parent;
      var u = i.sheet;
      var c = i.jss;
      var d = i.Renderer;
      var f = i.generateClassName;
      if (!(n = r({
        classes: this.classes,
        parent: a,
        sheet: u,
        jss: c,
        Renderer: d,
        generateClassName: f
      }, n)).selector && this.classes[e]) {
        n.selector = "." + (0, l.default)(this.classes[e]);
      }
      this.raw[e] = t;
      var p = (0, o.default)(e, t, n);
      var h = undefined;
      if (!n.selector && p instanceof s.default) {
        h = f(p, u);
        p.selector = "." + (0, l.default)(h);
      }
      this.register(p, h);
      var m = n.index === undefined ? this.index.length : n.index;
      this.index.splice(m, 0, p);
      return p;
    }
  }, {
    key: "get",
    value: function (e) {
      return this.map[e];
    }
  }, {
    key: "remove",
    value: function (e) {
      this.unregister(e);
      this.index.splice(this.indexOf(e), 1);
    }
  }, {
    key: "indexOf",
    value: function (e) {
      return this.index.indexOf(e);
    }
  }, {
    key: "process",
    value: function () {
      var e = this.options.jss.plugins;
      this.index.slice(0).forEach(e.onProcessRule, e);
    }
  }, {
    key: "register",
    value: function (e, t) {
      this.map[e.key] = e;
      if (e instanceof s.default) {
        this.map[e.selector] = e;
        if (t) {
          this.classes[e.key] = t;
        }
      }
    }
  }, {
    key: "unregister",
    value: function (e) {
      delete this.map[e.key];
      if (e instanceof s.default) {
        delete this.map[e.selector];
        delete this.classes[e.key];
      }
    }
  }, {
    key: "update",
    value: function (e, t) {
      var n = this.options;
      var r = n.jss.plugins;
      var i = n.sheet;
      if (typeof e != "string") {
        for (var o = 0; o < this.index.length; o++) {
          r.onUpdate(e, this.index[o], i);
        }
      } else {
        r.onUpdate(t, this.get(e), i);
      }
    }
  }, {
    key: "link",
    value: function (e) {
      var t = this.options.sheet.renderer.getUnescapedKeysMap(this.index);
      for (var n = 0; n < e.length; n++) {
        var r = e[n];
        var i = this.options.sheet.renderer.getKey(r);
        if (t[i]) {
          i = t[i];
        }
        var o = this.map[i];
        if (o) {
          (0, a.default)(o, r);
        }
      }
    }
  }, {
    key: "toString",
    value: function (e) {
      var t = "";
      var n = this.options.sheet;
      var r = !!n && n.options.link;
      for (var i = 0; i < this.index.length; i++) {
        var o = this.index[i].toString(e);
        if (o || r) {
          if (t) {
            t += "\n";
          }
          t += o;
        }
      }
      return t;
    }
  }]);
  return e;
}();
exports.default = c;