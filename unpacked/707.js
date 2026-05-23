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
  }
  r(e, [{
    key: "setStyle",
    value: function () {
      return true;
    }
  }, {
    key: "getStyle",
    value: function () {
      return "";
    }
  }, {
    key: "setSelector",
    value: function () {
      return true;
    }
  }, {
    key: "getKey",
    value: function () {
      return "";
    }
  }, {
    key: "attach",
    value: function () {}
  }, {
    key: "detach",
    value: function () {}
  }, {
    key: "deploy",
    value: function () {}
  }, {
    key: "insertRule",
    value: function () {
      return false;
    }
  }, {
    key: "deleteRule",
    value: function () {
      return true;
    }
  }, {
    key: "replaceRule",
    value: function () {
      return false;
    }
  }, {
    key: "getRules",
    value: function () {}
  }, {
    key: "indexOf",
    value: function () {
      return -1;
    }
  }]);
  return e;
}();
exports.default = i;