module.exports = function (e) {
  var t = [];
  t.toString = function () {
    return this.map(function (t) {
      var n = function (e, t) {
        var n = e[1] || "";
        var r = e[3];
        if (!r) {
          return n;
        }
        if (t && typeof btoa == "function") {
          a = r;
          var i = "/*# sourceMappingURL=data:application/json;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(a)))) + " */";
          var o = r.sources.map(function (e) {
            return "/*# sourceURL=" + r.sourceRoot + e + " */";
          });
          return [n].concat(o).concat([i]).join("\n");
        }
        var a;
        return [n].join("\n");
      }(t, e);
      if (t[2]) {
        return "@media " + t[2] + "{" + n + "}";
      } else {
        return n;
      }
    }).join("");
  };
  t.i = function (e, n) {
    if (typeof e == "string") {
      e = [[null, e, ""]];
    }
    var r = {};
    for (var i = 0; i < this.length; i++) {
      var o = this[i][0];
      if (typeof o == "number") {
        r[o] = true;
      }
    }
    for (i = 0; i < e.length; i++) {
      var a = e[i];
      if (typeof a[0] != "number" || !r[a[0]]) {
        if (n && !a[2]) {
          a[2] = n;
        } else if (n) {
          a[2] = "(" + a[2] + ") and (" + n + ")";
        }
        t.push(a);
      }
    }
  };
  return t;
};