var r;
var i;
var o;
i = [module, require("./1021.js"), require("./1023.js"), require("./1024.js")];
if ((o = typeof (r = function (e, t, n, r) {
  "use strict";

  var i = s(t);
  var o = s(n);
  var a = s(r);
  function s(e) {
    if (e && e.__esModule) {
      return e;
    } else {
      return {
        default: e
      };
    }
  }
  var l = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function (e) {
    return typeof e;
  } : function (e) {
    if (e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype) {
      return "symbol";
    } else {
      return typeof e;
    }
  };
  var u = function () {
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
  var c = function (e) {
    function t(e, n) {
      (function (e, t) {
        if (!(e instanceof t)) {
          throw new TypeError("Cannot call a class as a function");
        }
      })(this, t);
      var r = function (e, t) {
        if (!e) {
          throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        }
        if (!t || typeof t != "object" && typeof t != "function") {
          return e;
        } else {
          return t;
        }
      }(this, (t.__proto__ || Object.getPrototypeOf(t)).call(this));
      r.resolveOptions(n);
      r.listenClick(e);
      return r;
    }
    (function (e, t) {
      if (typeof t != "function" && t !== null) {
        throw new TypeError("Super expression must either be null or a function, not " + typeof t);
      }
      e.prototype = Object.create(t && t.prototype, {
        constructor: {
          value: e,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
      if (t) {
        if (Object.setPrototypeOf) {
          Object.setPrototypeOf(e, t);
        } else {
          e.__proto__ = t;
        }
      }
    })(t, e);
    u(t, [{
      key: "resolveOptions",
      value: function (e = {}) {
        this.action = typeof e.action == "function" ? e.action : this.defaultAction;
        this.target = typeof e.target == "function" ? e.target : this.defaultTarget;
        this.text = typeof e.text == "function" ? e.text : this.defaultText;
        this.container = l(e.container) === "object" ? e.container : document.body;
      }
    }, {
      key: "listenClick",
      value: function (e) {
        var t = this;
        this.listener = (0, a.default)(e, "click", function (e) {
          return t.onClick(e);
        });
      }
    }, {
      key: "onClick",
      value: function (e) {
        var t = e.delegateTarget || e.currentTarget;
        this.clipboardAction &&= null;
        this.clipboardAction = new i.default({
          action: this.action(t),
          target: this.target(t),
          text: this.text(t),
          container: this.container,
          trigger: t,
          emitter: this
        });
      }
    }, {
      key: "defaultAction",
      value: function (e) {
        return d("action", e);
      }
    }, {
      key: "defaultTarget",
      value: function (e) {
        var t = d("target", e);
        if (t) {
          return document.querySelector(t);
        }
      }
    }, {
      key: "defaultText",
      value: function (e) {
        return d("text", e);
      }
    }, {
      key: "destroy",
      value: function () {
        this.listener.destroy();
        if (this.clipboardAction) {
          this.clipboardAction.destroy();
          this.clipboardAction = null;
        }
      }
    }], [{
      key: "isSupported",
      value: function (e = ["copy", "cut"]) {
        var t = typeof e == "string" ? [e] : e;
        var n = !!document.queryCommandSupported;
        t.forEach(function (e) {
          n = n && !!document.queryCommandSupported(e);
        });
        return n;
      }
    }]);
    return t;
  }(o.default);
  function d(e, t) {
    var n = "data-clipboard-" + e;
    if (t.hasAttribute(n)) {
      return t.getAttribute(n);
    }
  }
  e.exports = c;
}) == "function" ? r.apply(exports, i) : r) !== undefined) {
  module.exports = o;
}