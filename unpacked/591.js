Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function () {
  var e = arguments.length <= 0 || arguments[0] === undefined ? "localStorage" : arguments[0];
  try {
    var t = window[e];
    t.setItem(r, "1");
    t.removeItem(r);
    return true;
  } catch (e) {
    return false;
  }
};
var r = "__test";