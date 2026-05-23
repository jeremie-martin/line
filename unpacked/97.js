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
var i = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function (e) {
  return typeof e;
} : function (e) {
  if (e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype) {
    return "symbol";
  } else {
    return typeof e;
  }
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
var a = u(require("./14.js"));
var s = u(require("./254.js"));
var l = u(require("./178.js"));
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
  function e(t, n, r) {
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, e);
    this.type = "style";
    this.isProcessed = false;
    var i = r.sheet;
    var o = r.Renderer;
    var a = r.selector;
    this.key = t;
    this.options = r;
    this.style = n;
    if (a) {
      this.selectorText = a;
    }
    this.renderer = i ? i.renderer : new o();
  }
  o(e, [{
    key: "prop",
    value: function (e, t) {
      if (t === undefined) {
        return this.style[e];
      }
      if (this.style[e] === t) {
        return this;
      }
      var n = (t = this.options.jss.plugins.onChangeValue(t, e, this)) == null || t === false;
      var r = e in this.style;
      if (n && !r) {
        return this;
      }
      var i = n && r;
      if (i) {
        delete this.style[e];
      } else {
        this.style[e] = t;
      }
      if (this.renderable) {
        if (i) {
          this.renderer.removeProperty(this.renderable, e);
        } else {
          this.renderer.setProperty(this.renderable, e, t);
        }
        return this;
      }
      var o = this.options.sheet;
      if (o && o.attached) {
        (0, a.default)(false, "Rule is not linked. Missing sheet option \"link: true\".");
      }
      return this;
    }
  }, {
    key: "applyTo",
    value: function (e) {
      var t = this.toJSON();
      for (var n in t) {
        this.renderer.setProperty(e, n, t[n]);
      }
      return this;
    }
  }, {
    key: "toJSON",
    value: function () {
      var e = {};
      for (var t in this.style) {
        var n = this.style[t];
        if ((n === undefined ? "undefined" : i(n)) !== "object") {
          e[t] = n;
        } else if (Array.isArray(n)) {
          e[t] = (0, l.default)(n);
        }
      }
      return e;
    }
  }, {
    key: "toString",
    value: function (e) {
      var t = this.options.sheet;
      var n = !!t && t.options.link ? r({}, e, {
        allowEmpty: true
      }) : e;
      return (0, s.default)(this.selector, this.style, n);
    }
  }, {
    key: "selector",
    set: function (e) {
      if (e !== this.selectorText && (this.selectorText = e, this.renderable && !this.renderer.setSelector(this.renderable, e) && this.renderable)) {
        var t = this.renderer.replaceRule(this.renderable, this);
        if (t) {
          this.renderable = t;
        }
      }
    },
    get: function () {
      return this.selectorText;
    }
  }]);
  return e;
}();
exports.default = c;