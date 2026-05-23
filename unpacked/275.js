var r = Object.getOwnPropertySymbols;
var i = Object.prototype.hasOwnProperty;
var o = Object.prototype.propertyIsEnumerable;
module.exports = function () {
  try {
    if (!Object.assign) {
      return false;
    }
    var e = new String("abc");
    e[5] = "de";
    if (Object.getOwnPropertyNames(e)[0] === "5") {
      return false;
    }
    var t = {};
    for (var n = 0; n < 10; n++) {
      t["_" + String.fromCharCode(n)] = n;
    }
    if (Object.getOwnPropertyNames(t).map(function (e) {
      return t[e];
    }).join("") !== "0123456789") {
      return false;
    }
    var r = {};
    "abcdefghijklmnopqrst".split("").forEach(function (e) {
      r[e] = e;
    });
    return Object.keys(Object.assign({}, r)).join("") === "abcdefghijklmnopqrst";
  } catch (e) {
    return false;
  }
}() ? Object.assign : function (e, t) {
  var n;
  var a;
  var s = function (e) {
    if (e === null || e === undefined) {
      throw new TypeError("Object.assign cannot be called with null or undefined");
    }
    return Object(e);
  }(e);
  for (var l = 1; l < arguments.length; l++) {
    for (var u in n = Object(arguments[l])) {
      if (i.call(n, u)) {
        s[u] = n[u];
      }
    }
    if (r) {
      a = r(n);
      for (var c = 0; c < a.length; c++) {
        if (o.call(n, a[c])) {
          s[a[c]] = n[a[c]];
        }
      }
    }
  }
  return s;
};