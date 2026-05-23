Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = s(require("./3.js"));
var i = s(require("./0.js"));
s(require("./1.js"));
var o = require("./172.js");
var a = s(o);
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = function (e = {}) {
  return function (t) {
    var n = e.breakpoint;
    var s = n === undefined ? "sm" : n;
    function l(e) {
      return i.default.createElement(t, (0, r.default)({
        fullScreen: (0, o.isWidthDown)(s, e.width)
      }, e));
    }
    l.propTypes = {};
    return (0, a.default)()(l);
  };
};