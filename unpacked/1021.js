var r;
var i;
var o;
i = [module, require("./1022.js")];
if ((o = typeof (r = function (e, t) {
  "use strict";

  var n;
  var r = (n = t) && n.__esModule ? n : {
    default: n
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
  var a = function () {
    function e(t) {
      (function (e, t) {
        if (!(e instanceof t)) {
          throw new TypeError("Cannot call a class as a function");
        }
      })(this, e);
      this.resolveOptions(t);
      this.initSelection();
    }
    o(e, [{
      key: "resolveOptions",
      value: function (e = {}) {
        this.action = e.action;
        this.container = e.container;
        this.emitter = e.emitter;
        this.target = e.target;
        this.text = e.text;
        this.trigger = e.trigger;
        this.selectedText = "";
      }
    }, {
      key: "initSelection",
      value: function () {
        if (this.text) {
          this.selectFake();
        } else if (this.target) {
          this.selectTarget();
        }
      }
    }, {
      key: "selectFake",
      value: function () {
        var e = this;
        var t = document.documentElement.getAttribute("dir") == "rtl";
        this.removeFake();
        this.fakeHandlerCallback = function () {
          return e.removeFake();
        };
        this.fakeHandler = this.container.addEventListener("click", this.fakeHandlerCallback) || true;
        this.fakeElem = document.createElement("textarea");
        this.fakeElem.style.fontSize = "12pt";
        this.fakeElem.style.border = "0";
        this.fakeElem.style.padding = "0";
        this.fakeElem.style.margin = "0";
        this.fakeElem.style.position = "absolute";
        this.fakeElem.style[t ? "right" : "left"] = "-9999px";
        var n = window.pageYOffset || document.documentElement.scrollTop;
        this.fakeElem.style.top = n + "px";
        this.fakeElem.setAttribute("readonly", "");
        this.fakeElem.value = this.text;
        this.container.appendChild(this.fakeElem);
        this.selectedText = (0, r.default)(this.fakeElem);
        this.copyText();
      }
    }, {
      key: "removeFake",
      value: function () {
        if (this.fakeHandler) {
          this.container.removeEventListener("click", this.fakeHandlerCallback);
          this.fakeHandler = null;
          this.fakeHandlerCallback = null;
        }
        if (this.fakeElem) {
          this.container.removeChild(this.fakeElem);
          this.fakeElem = null;
        }
      }
    }, {
      key: "selectTarget",
      value: function () {
        this.selectedText = (0, r.default)(this.target);
        this.copyText();
      }
    }, {
      key: "copyText",
      value: function () {
        var e = undefined;
        try {
          e = document.execCommand(this.action);
        } catch (t) {
          e = false;
        }
        this.handleResult(e);
      }
    }, {
      key: "handleResult",
      value: function (e) {
        this.emitter.emit(e ? "success" : "error", {
          action: this.action,
          text: this.selectedText,
          trigger: this.trigger,
          clearSelection: this.clearSelection.bind(this)
        });
      }
    }, {
      key: "clearSelection",
      value: function () {
        if (this.trigger) {
          this.trigger.focus();
        }
        window.getSelection().removeAllRanges();
      }
    }, {
      key: "destroy",
      value: function () {
        this.removeFake();
      }
    }, {
      key: "action",
      set: function (e = "copy") {
        this._action = e;
        if (this._action !== "copy" && this._action !== "cut") {
          throw new Error("Invalid \"action\" value, use either \"copy\" or \"cut\"");
        }
      },
      get: function () {
        return this._action;
      }
    }, {
      key: "target",
      set: function (e) {
        if (e !== undefined) {
          if (!e || (e === undefined ? "undefined" : i(e)) !== "object" || e.nodeType !== 1) {
            throw new Error("Invalid \"target\" value, use a valid Element");
          }
          if (this.action === "copy" && e.hasAttribute("disabled")) {
            throw new Error("Invalid \"target\" attribute. Please use \"readonly\" instead of \"disabled\" attribute");
          }
          if (this.action === "cut" && (e.hasAttribute("readonly") || e.hasAttribute("disabled"))) {
            throw new Error("Invalid \"target\" attribute. You can't cut text from elements with \"readonly\" or \"disabled\" attributes");
          }
          this._target = e;
        }
      },
      get: function () {
        return this._target;
      }
    }]);
    return e;
  }();
  e.exports = a;
}) == "function" ? r.apply(exports, i) : r) !== undefined) {
  module.exports = o;
}