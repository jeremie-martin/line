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
    this.sheets = [];
    this.refs = [];
    this.keys = [];
  }
  i(e, [{
    key: "get",
    value: function (e) {
      var t = this.keys.indexOf(e);
      return this.sheets[t];
    }
  }, {
    key: "add",
    value: function (e, t) {
      var n = this.sheets;
      var r = this.refs;
      var i = this.keys;
      var o = n.indexOf(t);
      if (o !== -1) {
        return o;
      } else {
        n.push(t);
        r.push(0);
        i.push(e);
        return n.length - 1;
      }
    }
  }, {
    key: "manage",
    value: function (e) {
      var t = this.keys.indexOf(e);
      var n = this.sheets[t];
      if (this.refs[t] === 0) {
        n.attach();
      }
      this.refs[t]++;
      if (!this.keys[t]) {
        this.keys.splice(t, 0, e);
      }
      return n;
    }
  }, {
    key: "unmanage",
    value: function (e) {
      var t = this.keys.indexOf(e);
      if (t !== -1) {
        if (this.refs[t] > 0) {
          this.refs[t]--;
          if (this.refs[t] === 0) {
            this.sheets[t].detach();
          }
        }
      } else {
        (0, a.default)(false, "SheetsManager: can't find sheet to unmanage");
      }
    }
  }, {
    key: "size",
    get: function () {
      return this.keys.length;
    }
  }]);
  return e;
}();
exports.default = s;