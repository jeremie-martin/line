Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = function () {
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
var i = function () {
  function e(t, n, r) {
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, e);
    this.type = "simple";
    this.isProcessed = false;
    this.key = t;
    this.value = n;
    this.options = r;
  }
  r(e, [{
    key: "toString",
    value: function (e) {
      if (Array.isArray(this.value)) {
        var t = "";
        for (var n = 0; n < this.value.length; n++) {
          t += this.key + " " + this.value[n] + ";";
          if (this.value[n + 1]) {
            t += "\n";
          }
        }
        return t;
      }
      return this.key + " " + this.value + ";";
    }
  }]);
  return e;
}();
exports.default = i;