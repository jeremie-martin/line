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
var i = l(require("./14.js"));
var o = l(require("./255.js"));
var a = l(require("./97.js"));
var s = l(require("./178.js"));
function l(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function u(e) {
  var t = undefined;
  return function () {
    t ||= e();
    return t;
  };
}
function c(e, t) {
  try {
    return e.style.getPropertyValue(t);
  } catch (e) {
    return "";
  }
}
function d(e, t, n) {
  try {
    var r = n;
    if (Array.isArray(n) && (r = (0, s.default)(n, true), n[n.length - 1] === "!important")) {
      e.style.setProperty(t, r, "important");
      return true;
    }
    e.style.setProperty(t, r);
  } catch (e) {
    return false;
  }
  return true;
}
function f(e, t) {
  try {
    e.style.removeProperty(t);
  } catch (e) {
    (0, i.default)(false, "[JSS] DOMException \"%s\" was thrown. Tried to remove property \"%s\".", e.message, t);
  }
}
var p;
var h = 1;
var m = 7;
p = function (e, t = 0) {
  return e.substr(t, e.indexOf("{") - 1);
};
function y(e) {
  if (e.type === h) {
    return e.selectorText;
  }
  if (e.type === m) {
    var t = e.name;
    if (t) {
      return "@keyframes " + t;
    }
    var n = e.cssText;
    return "@" + p(n, n.indexOf("keyframes"));
  }
  return p(e.cssText);
}
function g(e, t) {
  e.selectorText = t;
  return e.selectorText === t;
}
var v;
var b;
var _ = u(function () {
  return document.head || document.getElementsByTagName("head")[0];
});
v = undefined;
b = false;
function w(e) {
  var t = {};
  v ||= document.createElement("style");
  for (var n = 0; n < e.length; n++) {
    var r = e[n];
    if (r instanceof a.default) {
      var i = r.selector;
      if (i && i.indexOf("\\") !== -1) {
        if (!b) {
          _().appendChild(v);
          b = true;
        }
        v.textContent = i + " {}";
        var o = v.sheet;
        if (o) {
          var s = o.cssRules;
          if (s) {
            t[s[0].selectorText] = r.key;
          }
        }
      }
    }
  }
  if (b) {
    _().removeChild(v);
    b = false;
  }
  return t;
}
function x(e) {
  var t = o.default.registry;
  if (t.length > 0) {
    var n = function (e, t) {
      for (var n = 0; n < e.length; n++) {
        var r = e[n];
        if (r.attached && r.options.index > t.index && r.options.insertionPoint === t.insertionPoint) {
          return r;
        }
      }
      return null;
    }(t, e);
    if (n) {
      return n.renderer.element;
    }
    if (n = function (e, t) {
      for (var n = e.length - 1; n >= 0; n--) {
        var r = e[n];
        if (r.attached && r.options.insertionPoint === t.insertionPoint) {
          return r;
        }
      }
      return null;
    }(t, e)) {
      return n.renderer.element.nextElementSibling;
    }
  }
  var r = e.insertionPoint;
  if (r && typeof r == "string") {
    var a = function (e) {
      for (var t = _(), n = 0; n < t.childNodes.length; n++) {
        var r = t.childNodes[n];
        if (r.nodeType === 8 && r.nodeValue.trim() === e) {
          return r;
        }
      }
      return null;
    }(r);
    if (a) {
      return a.nextSibling;
    }
    (0, i.default)(r === "jss", "[JSS] Insertion point \"%s\" not found.", r);
  }
  return null;
}
var E = u(function () {
  var e = document.querySelector("meta[property=\"csp-nonce\"]");
  if (e) {
    return e.getAttribute("content");
  } else {
    return null;
  }
});
var S = function () {
  function e(t) {
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, e);
    this.getPropertyValue = c;
    this.setProperty = d;
    this.removeProperty = f;
    this.setSelector = g;
    this.getKey = y;
    this.getUnescapedKeysMap = w;
    this.hasInsertedRules = false;
    if (t) {
      o.default.add(t);
    }
    this.sheet = t;
    var n = this.sheet ? this.sheet.options : {};
    var r = n.media;
    var i = n.meta;
    var a = n.element;
    this.element = a || document.createElement("style");
    this.element.type = "text/css";
    this.element.setAttribute("data-jss", "");
    if (r) {
      this.element.setAttribute("media", r);
    }
    if (i) {
      this.element.setAttribute("data-meta", i);
    }
    var s = E();
    if (s) {
      this.element.setAttribute("nonce", s);
    }
  }
  r(e, [{
    key: "attach",
    value: function () {
      if (!this.element.parentNode && this.sheet) {
        if (this.hasInsertedRules) {
          this.deploy();
          this.hasInsertedRules = false;
        }
        (function (e, t) {
          var n = t.insertionPoint;
          var r = x(t);
          if (r) {
            var o = r.parentNode;
            if (o) {
              o.insertBefore(e, r);
            }
          } else if (n && typeof n.nodeType == "number") {
            var a = n;
            var s = a.parentNode;
            if (s) {
              s.insertBefore(e, a.nextSibling);
            } else {
              (0, i.default)(false, "[JSS] Insertion point is not in the DOM.");
            }
          } else {
            _().insertBefore(e, r);
          }
        })(this.element, this.sheet.options);
      }
    }
  }, {
    key: "detach",
    value: function () {
      this.element.parentNode.removeChild(this.element);
    }
  }, {
    key: "deploy",
    value: function () {
      if (this.sheet) {
        this.element.textContent = "\n" + this.sheet.toString() + "\n";
      }
    }
  }, {
    key: "insertRule",
    value: function (e, t) {
      var n = this.element.sheet;
      var r = n.cssRules;
      var o = e.toString();
      t ||= r.length;
      if (!o) {
        return false;
      }
      try {
        n.insertRule(o, t);
      } catch (t) {
        (0, i.default)(false, "[JSS] Can not insert an unsupported rule \n\r%s", e);
        return false;
      }
      this.hasInsertedRules = true;
      return r[t];
    }
  }, {
    key: "deleteRule",
    value: function (e) {
      var t = this.element.sheet;
      var n = this.indexOf(e);
      return n !== -1 && (t.deleteRule(n), true);
    }
  }, {
    key: "indexOf",
    value: function (e) {
      for (var t = this.element.sheet.cssRules, n = 0; n < t.length; n++) {
        if (e === t[n]) {
          return n;
        }
      }
      return -1;
    }
  }, {
    key: "replaceRule",
    value: function (e, t) {
      var n = this.indexOf(e);
      var r = this.insertRule(t, n);
      this.element.sheet.deleteRule(n);
      return r;
    }
  }, {
    key: "getRules",
    value: function () {
      return this.element.sheet.cssRules;
    }
  }]);
  return e;
}();
exports.default = S;