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
exports.hasCookies = function () {
  var e = s.prototype;
  var t = e.setItem;
  var n = e.getItem;
  var r = e.removeItem;
  try {
    t("__test", "1");
    var i = n("__test");
    r("__test");
    return i == "1";
  } catch (e) {
    return false;
  }
};
var i;
var o = require("./593.js");
var a = (i = o) && i.__esModule ? i : {
  default: i
};
var s = function () {
  function e() {
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, e);
  }
  r(e, [{
    key: "getItem",
    value: function (e) {
      var t = a.default.parse(document.cookie);
      if (t && t.hasOwnProperty("lS_" + e)) {
        return t["lS_" + e];
      } else {
        return null;
      }
    }
  }, {
    key: "setItem",
    value: function (e, t) {
      document.cookie = a.default.serialize("lS_" + e, t, {
        path: "/"
      });
      return t;
    }
  }, {
    key: "removeItem",
    value: function (e) {
      document.cookie = a.default.serialize("lS_" + e, "", {
        path: "/",
        maxAge: -1
      });
      return null;
    }
  }, {
    key: "clear",
    value: function () {
      var e = a.default.parse(document.cookie);
      for (var t in e) {
        if (t.indexOf("lS_") === 0) {
          this.removeItem(t.substr("lS_".length));
        }
      }
      return null;
    }
  }]);
  return e;
}();
exports.default = s;