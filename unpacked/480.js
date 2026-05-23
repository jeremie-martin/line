Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e) {
  var t;
  var n = e.Symbol;
  if (typeof n == "function") {
    if (n.observable) {
      t = n.observable;
    } else {
      t = n("observable");
      n.observable = t;
    }
  } else {
    t = "@@observable";
  }
  return t;
};