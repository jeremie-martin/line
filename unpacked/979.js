Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
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
var o = require("./14.js");
var a = (r = o) && r.__esModule ? r : {
  default: r
};
var s = function () {
  function e() {
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, e);
    this.hooks = {
      onCreateRule: [],
      onProcessRule: [],
      onProcessStyle: [],
      onProcessSheet: [],
      onChangeValue: [],
      onUpdate: []
    };
  }
  i(e, [{
    key: "onCreateRule",
    value: function (e, t, n) {
      for (var r = 0; r < this.hooks.onCreateRule.length; r++) {
        var i = this.hooks.onCreateRule[r](e, t, n);
        if (i) {
          return i;
        }
      }
      return null;
    }
  }, {
    key: "onProcessRule",
    value: function (e) {
      if (!e.isProcessed) {
        var t = e.options.sheet;
        for (var n = 0; n < this.hooks.onProcessRule.length; n++) {
          this.hooks.onProcessRule[n](e, t);
        }
        if (e.style) {
          this.onProcessStyle(e.style, e, t);
        }
        e.isProcessed = true;
      }
    }
  }, {
    key: "onProcessStyle",
    value: function (e, t, n) {
      var r = e;
      for (var i = 0; i < this.hooks.onProcessStyle.length; i++) {
        r = this.hooks.onProcessStyle[i](r, t, n);
        t.style = r;
      }
    }
  }, {
    key: "onProcessSheet",
    value: function (e) {
      for (var t = 0; t < this.hooks.onProcessSheet.length; t++) {
        this.hooks.onProcessSheet[t](e);
      }
    }
  }, {
    key: "onUpdate",
    value: function (e, t, n) {
      for (var r = 0; r < this.hooks.onUpdate.length; r++) {
        this.hooks.onUpdate[r](e, t, n);
      }
    }
  }, {
    key: "onChangeValue",
    value: function (e, t, n) {
      var r = e;
      for (var i = 0; i < this.hooks.onChangeValue.length; i++) {
        r = this.hooks.onChangeValue[i](r, t, n);
      }
      return r;
    }
  }, {
    key: "use",
    value: function (e) {
      for (var t in e) {
        if (this.hooks[t]) {
          this.hooks[t].push(e[t]);
        } else {
          (0, a.default)(false, "[JSS] Unknown hook \"%s\".", t);
        }
      }
    }
  }]);
  return e;
}();
exports.default = s;