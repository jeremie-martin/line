Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
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
var a = require("./120.js");
var s = (r = a) && r.__esModule ? r : {
  default: r
};
var l = function () {
  function e(t, n, r) {
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, e);
    this.type = "conditional";
    this.isProcessed = false;
    this.key = t;
    this.options = r;
    this.rules = new s.default(i({}, r, {
      parent: this
    }));
    for (var o in n) {
      this.rules.add(o, n[o]);
    }
    this.rules.process();
  }
  o(e, [{
    key: "getRule",
    value: function (e) {
      return this.rules.get(e);
    }
  }, {
    key: "indexOf",
    value: function (e) {
      return this.rules.indexOf(e);
    }
  }, {
    key: "addRule",
    value: function (e, t, n) {
      var r = this.rules.add(e, t, n);
      this.options.jss.plugins.onProcessRule(r);
      return r;
    }
  }, {
    key: "toString",
    value: function (e = {
      indent: 1
    }) {
      var t = this.rules.toString(e);
      if (t) {
        return this.key + " {\n" + t + "\n}";
      } else {
        return "";
      }
    }
  }]);
  return e;
}();
exports.default = l;