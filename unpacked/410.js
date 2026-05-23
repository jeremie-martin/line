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
var o = s(require("./408.js"));
var a = s(require("./131.js"));
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var l = function () {
  function e(t, n) {
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, e);
    this.attached = false;
    this.deployed = false;
    this.linked = false;
    this.classes = {};
    this.options = r({}, n, {
      sheet: this,
      parent: this,
      classes: this.classes
    });
    this.renderer = new n.Renderer(this);
    this.rules = new a.default(this.options);
    for (var i in t) {
      this.rules.add(i, t[i]);
    }
    this.rules.process();
  }
  i(e, [{
    key: "attach",
    value: function () {
      if (this.attached) {
        return this;
      } else {
        if (!this.deployed) {
          this.deploy();
        }
        this.renderer.attach();
        if (!this.linked && this.options.link) {
          this.link();
        }
        this.attached = true;
        return this;
      }
    }
  }, {
    key: "detach",
    value: function () {
      if (this.attached) {
        this.renderer.detach();
        this.attached = false;
        return this;
      } else {
        return this;
      }
    }
  }, {
    key: "addRule",
    value: function (e, t, n) {
      var r = this.queue;
      if (this.attached && !r) {
        this.queue = [];
      }
      var i = this.rules.add(e, t, n);
      this.options.jss.plugins.onProcessRule(i);
      if (this.attached) {
        if (this.deployed) {
          if (r) {
            r.push(i);
          } else {
            this.insertRule(i);
            if (this.queue) {
              this.queue.forEach(this.insertRule, this);
              this.queue = undefined;
            }
          }
          return i;
        } else {
          return i;
        }
      } else {
        this.deployed = false;
        return i;
      }
    }
  }, {
    key: "insertRule",
    value: function (e) {
      var t = this.renderer.insertRule(e);
      if (t && this.options.link) {
        (0, o.default)(e, t);
      }
    }
  }, {
    key: "addRules",
    value: function (e, t) {
      var n = [];
      for (var r in e) {
        n.push(this.addRule(r, e[r], t));
      }
      return n;
    }
  }, {
    key: "getRule",
    value: function (e) {
      return this.rules.get(e);
    }
  }, {
    key: "deleteRule",
    value: function (e) {
      var t = this.rules.get(e);
      return !!t && (this.rules.remove(t), !this.attached || !t.renderable || this.renderer.deleteRule(t.renderable));
    }
  }, {
    key: "indexOf",
    value: function (e) {
      return this.rules.indexOf(e);
    }
  }, {
    key: "deploy",
    value: function () {
      this.renderer.deploy();
      this.deployed = true;
      return this;
    }
  }, {
    key: "link",
    value: function () {
      var e = this.renderer.getRules();
      if (e) {
        this.rules.link(e);
      }
      this.linked = true;
      return this;
    }
  }, {
    key: "update",
    value: function (e, t) {
      this.rules.update(e, t);
      return this;
    }
  }, {
    key: "toString",
    value: function (e) {
      return this.rules.toString(e);
    }
  }]);
  return e;
}();
exports.default = l;