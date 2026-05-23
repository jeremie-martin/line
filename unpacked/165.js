Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./166.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
function a(e, t) {
  if (t) {
    do {
      if (t === e) {
        return true;
      }
    } while (t = t.parentNode);
  }
  return false;
}
exports.default = o.default ? function (e, t) {
  if (e.contains) {
    return e.contains(t);
  } else if (e.compareDocumentPosition) {
    return e === t || !!(e.compareDocumentPosition(t) & 16);
  } else {
    return a(e, t);
  }
} : a;
module.exports = exports.default;