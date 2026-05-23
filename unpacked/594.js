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
    this._data = {};
  }
  r(e, [{
    key: "getItem",
    value: function (e) {
      if (this._data.hasOwnProperty(e)) {
        return this._data[e];
      } else {
        return undefined;
      }
    }
  }, {
    key: "setItem",
    value: function (e, t) {
      return this._data[e] = String(t);
    }
  }, {
    key: "removeItem",
    value: function (e) {
      return delete this._data[e];
    }
  }, {
    key: "clear",
    value: function () {
      return this._data = {};
    }
  }]);
  return e;
}();
exports.default = i;