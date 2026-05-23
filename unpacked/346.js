Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = Object.assign || function (e) {
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
exports.default = function () {
  return {
    onCreateRule: function (e, t, n) {
      if (e === s) {
        return new u(e, t, n);
      }
      if (e[0] === "@" && e.substr(0, l.length) === l) {
        return new c(e, t, n);
      }
      var r = n.parent;
      if (r) {
        if (r.type === "global" || r.options.parent.type === "global") {
          n.global = true;
        }
      }
      if (n.global) {
        n.selector = e;
      }
      return null;
    },
    onProcessRule: function (e) {
      if (e.type !== "style") {
        return;
      }
      (function (e) {
        var t = e.options;
        var n = e.style;
        var i = n[s];
        if (!i) {
          return;
        }
        for (var o in i) {
          t.sheet.addRule(o, i[o], r({}, t, {
            selector: f(o, e.selector)
          }));
        }
        delete n[s];
      })(e);
      (function (e) {
        var t = e.options;
        var n = e.style;
        for (var i in n) {
          if (i.substr(0, s.length) === s) {
            var o = f(i.substr(s.length), e.selector);
            t.sheet.addRule(o, n[i], r({}, t, {
              selector: o
            }));
            delete n[i];
          }
        }
      })(e);
    }
  };
};
var o = require("./339.js");
function a(e, t) {
  if (!(e instanceof t)) {
    throw new TypeError("Cannot call a class as a function");
  }
}
var s = "@global";
var l = "@global ";
var u = function () {
  function e(t, n, i) {
    a(this, e);
    this.type = "global";
    this.key = t;
    this.options = i;
    this.rules = new o.RuleList(r({}, i, {
      parent: this
    }));
    for (var s in n) {
      this.rules.add(s, n[s], {
        selector: s
      });
    }
    this.rules.process();
  }
  i(e, [{
    key: "getRule",
    value: function (e) {
      return this.rules.get(e);
    }
  }, {
    key: "addRule",
    value: function (e, t, n) {
      var r = this.rules.add(e, t, n);
      this.options.jss.plugins.onProcessRule(r);
      return r;
    }
  }, {
    key: "indexOf",
    value: function (e) {
      return this.rules.indexOf(e);
    }
  }, {
    key: "toString",
    value: function () {
      return this.rules.toString();
    }
  }]);
  return e;
}();
var c = function () {
  function e(t, n, i) {
    a(this, e);
    this.name = t;
    this.options = i;
    var o = t.substr(l.length);
    this.rule = i.jss.createRule(o, n, r({}, i, {
      parent: this,
      selector: o
    }));
  }
  i(e, [{
    key: "toString",
    value: function (e) {
      return this.rule.toString(e);
    }
  }]);
  return e;
}();
var d = /\s*,\s*/g;
function f(e, t) {
  for (var n = e.split(d), r = "", i = 0; i < n.length; i++) {
    r += t + " " + n[i].trim();
    if (n[i + 1]) {
      r += ", ";
    }
  }
  return r;
}