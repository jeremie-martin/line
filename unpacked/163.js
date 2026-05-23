Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.specialProperty = undefined;
var r = a(require("./6.js"));
var i = a(require("./40.js"));
var o = a(require("./3.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = function (e, t) {
  return (0, o.default)({}, e, (0, r.default)({}, s, function (n) {
    var r = (0, i.default)(n).filter(function (t) {
      return !e.hasOwnProperty(t);
    });
    if (r.length > 0) {
      return new TypeError(t + ": unknown props found: " + r.join(", ") + ". Please remove the unknown properties.");
    } else {
      return null;
    }
  }));
};
var s = exports.specialProperty = "exact-prop: ​";