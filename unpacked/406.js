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
  function e() {
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, e);
    this.registry = [];
  }
  r(e, [{
    key: "add",
    value: function (e) {
      var t = this.registry;
      var n = e.options.index;
      if (t.indexOf(e) === -1) {
        if (t.length === 0 || n >= this.index) {
          t.push(e);
        } else {
          for (var r = 0; r < t.length; r++) {
            if (t[r].options.index > n) {
              t.splice(r, 0, e);
              return;
            }
          }
        }
      }
    }
  }, {
    key: "reset",
    value: function () {
      this.registry = [];
    }
  }, {
    key: "remove",
    value: function (e) {
      var t = this.registry.indexOf(e);
      this.registry.splice(t, 1);
    }
  }, {
    key: "toString",
    value: function (e) {
      return this.registry.filter(function (e) {
        return e.attached;
      }).map(function (t) {
        return t.toString(e);
      }).join("\n");
    }
  }, {
    key: "index",
    get: function () {
      if (this.registry.length === 0) {
        return 0;
      } else {
        return this.registry[this.registry.length - 1].options.index;
      }
    }
  }]);
  return e;
}();
exports.default = i;