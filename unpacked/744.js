exports.__esModule = true;
exports.getChildMapping = function (e, t) {
  var n = Object.create(null);
  if (e) {
    r.Children.map(e, function (e) {
      return e;
    }).forEach(function (e) {
      n[e.key] = function (e) {
        if (t && (0, r.isValidElement)(e)) {
          return t(e);
        } else {
          return e;
        }
      }(e);
    });
  }
  return n;
};
exports.mergeChildMappings = function (e, t) {
  function n(n) {
    if (n in t) {
      return t[n];
    } else {
      return e[n];
    }
  }
  e = e || {};
  t = t || {};
  var r = Object.create(null);
  var i = [];
  for (var o in e) {
    if (o in t) {
      if (i.length) {
        r[o] = i;
        i = [];
      }
    } else {
      i.push(o);
    }
  }
  var a = undefined;
  var s = {};
  for (var l in t) {
    if (r[l]) {
      for (a = 0; a < r[l].length; a++) {
        var u = r[l][a];
        s[r[l][a]] = n(u);
      }
    }
    s[l] = n(l);
  }
  for (a = 0; a < i.length; a++) {
    s[i[a]] = n(i[a]);
  }
  return s;
};
var r = require("./0.js");