Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function (e) {
  return typeof e;
} : function (e) {
  if (e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype) {
    return "symbol";
  } else {
    return typeof e;
  }
};
exports.default = function (e) {
  return function e(t) {
    var n = null;
    for (var i in t) {
      var o = t[i];
      var a = o === undefined ? "undefined" : r(o);
      if (a === "function") {
        n ||= {};
        n[i] = o;
      } else if (a === "object" && o !== null && !Array.isArray(o)) {
        var s = e(o);
        if (s) {
          n ||= {};
          n[i] = s;
        }
      }
    }
    return n;
  }(e);
};