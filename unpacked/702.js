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
var o = require("./232.js");
var a = (r = o) && r.__esModule ? r : {
  default: r
};
var s = function () {
  function e(t, n, r) {
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, e);
    this.type = "viewport";
    this.isProcessed = false;
    this.key = t;
    this.style = n;
    this.options = r;
  }
  i(e, [{
    key: "toString",
    value: function (e) {
      return (0, a.default)(this.key, this.style, e);
    }
  }]);
  return e;
}();
exports.default = s;