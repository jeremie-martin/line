Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function (e) {
  return typeof e;
} : function (e) {
  if (e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype) {
    return "symbol";
  } else {
    return typeof e;
  }
};
var i = Object.assign || function (e) {
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
var o = function () {
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
var a = v(require("./121.js"));
var s = v(require("./344.js"));
var l = v(require("./696.js"));
var u = v(require("./697.js"));
var c = v(require("./703.js"));
var d = v(require("./704.js"));
var f = v(require("./233.js"));
var p = v(require("./86.js"));
var h = v(require("./343.js"));
var m = v(require("./161.js"));
var y = v(require("./706.js"));
var g = v(require("./707.js"));
function v(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var b = u.default.concat([c.default, d.default]);
var _ = 0;
var w = function () {
  function e(t) {
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, e);
    this.id = _++;
    this.version = "9.5.1";
    this.plugins = new l.default();
    this.options = {
      createGenerateClassName: h.default,
      Renderer: a.default ? y.default : g.default,
      plugins: []
    };
    this.generateClassName = (0, h.default)();
    this.use.apply(this, b);
    this.setup(t);
  }
  o(e, [{
    key: "setup",
    value: function (e = {}) {
      if (e.createGenerateClassName) {
        this.options.createGenerateClassName = e.createGenerateClassName;
        this.generateClassName = e.createGenerateClassName();
      }
      if (e.insertionPoint != null) {
        this.options.insertionPoint = e.insertionPoint;
      }
      if (e.virtual || e.Renderer) {
        this.options.Renderer = e.Renderer || (e.virtual ? g.default : y.default);
      }
      if (e.plugins) {
        this.use.apply(this, e.plugins);
      }
      return this;
    }
  }, {
    key: "createStyleSheet",
    value: function (e, t = {}) {
      var n = t.index;
      if (typeof n != "number") {
        n = f.default.index === 0 ? 0 : f.default.index + 1;
      }
      var r = new s.default(e, i({}, t, {
        jss: this,
        generateClassName: t.generateClassName || this.generateClassName,
        insertionPoint: this.options.insertionPoint,
        Renderer: this.options.Renderer,
        index: n
      }));
      this.plugins.onProcessSheet(r);
      return r;
    }
  }, {
    key: "removeStyleSheet",
    value: function (e) {
      e.detach();
      f.default.remove(e);
      return this;
    }
  }, {
    key: "createRule",
    value: function (e, t = {}, n = {}) {
      if ((e === undefined ? "undefined" : r(e)) === "object") {
        n = t;
        t = e;
        e = undefined;
      }
      var i = n;
      i.jss = this;
      i.Renderer = this.options.Renderer;
      i.generateClassName ||= this.generateClassName;
      i.classes ||= {};
      var o = (0, m.default)(e, t, i);
      if (!i.selector && o instanceof p.default) {
        o.selector = "." + i.generateClassName(o);
      }
      this.plugins.onProcessRule(o);
      return o;
    }
  }, {
    key: "use",
    value: function () {
      var e = this;
      for (var t = arguments.length, n = Array(t), r = 0; r < t; r++) {
        n[r] = arguments[r];
      }
      n.forEach(function (t) {
        if (e.options.plugins.indexOf(t) === -1) {
          e.options.plugins.push(t);
          e.plugins.use(t);
        }
      });
      return this;
    }
  }]);
  return e;
}();
exports.default = w;