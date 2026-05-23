function r(e) {
  return function (t) {
    var n = t.dispatch;
    var r = t.getState;
    return function (t) {
      return function (i) {
        if (typeof i == "function") {
          return i(n, r, e);
        } else {
          return t(i);
        }
      };
    };
  };
}
exports.__esModule = true;
var i = r();
i.withExtraArgument = r;
exports.default = i;