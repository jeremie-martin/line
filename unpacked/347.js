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
exports.default = function () {
  function e(e) {
    return function (t, n) {
      var r = e.getRule(n);
      if (r) {
        return r.selector;
      } else {
        (0, a.default)(false, "[JSS] Could not find the referenced rule %s in %s.", n, e.options.meta || e);
        return n;
      }
    };
  }
  function t(e) {
    return e.indexOf("&") !== -1;
  }
  function n(e, n) {
    for (var r = n.split(s), i = e.split(s), o = "", a = 0; a < r.length; a++) {
      var u = r[a];
      for (var c = 0; c < i.length; c++) {
        var d = i[c];
        if (o) {
          o += ", ";
        }
        o += t(d) ? d.replace(l, u) : u + " " + d;
      }
    }
    return o;
  }
  function i(e, t, n) {
    if (n) {
      return r({}, n, {
        index: n.index + 1
      });
    }
    var i = e.options.nestingLevel;
    i = i === undefined ? 1 : i + 1;
    return r({}, e.options, {
      nestingLevel: i,
      index: t.indexOf(e) + 1
    });
  }
  return {
    onProcessStyle: function (o, a) {
      if (a.type !== "style") {
        return o;
      }
      var s = a.options.parent;
      var l = undefined;
      var c = undefined;
      for (var d in o) {
        var f = t(d);
        var p = d[0] === "@";
        if (f || p) {
          l = i(a, s, l);
          if (f) {
            var h = n(d, a.selector);
            c ||= e(s);
            h = h.replace(u, c);
            s.addRule(h, o[d], r({}, l, {
              selector: h
            }));
          } else if (p) {
            s.addRule(d, null, l).addRule(a.key, o[d], {
              selector: a.selector
            });
          }
          delete o[d];
        }
      }
      return o;
    }
  };
};
var i;
var o = require("./14.js");
var a = (i = o) && i.__esModule ? i : {
  default: i
};
var s = /\s*,\s*/g;
var l = /&/g;
var u = /\$([\w-]+)/g;