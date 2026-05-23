Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e) {
  return e.replace(r, i);
};
var r = /[-\s]+(.)?/g;
function i(e, t) {
  if (t) {
    return t.toUpperCase();
  } else {
    return "";
  }
}