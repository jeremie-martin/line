Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, t = {}) {
  if (t.index === undefined) {
    t.index = a++;
  }
  return function (n = s) {
    var o = (0, i.default)(e, n, t);
    return (0, r.default)(o, n, {
      inner: true
    });
  };
};
var r = o(require("./159.js"));
var i = o(require("./969.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var a = -100000;
function s(e) {
  return e.children || null;
}