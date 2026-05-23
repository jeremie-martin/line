Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = /([A-Z])/g;
function i(e) {
  return "-" + e.toLowerCase();
}
exports.default = function (e) {
  return e.replace(r, i);
};