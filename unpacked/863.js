Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e) {
  return !!e && !!r.test(e);
};
var r = /^((translate|rotate|scale)(X|Y|Z|3d)?|matrix(3d)?|perspective|skew(X|Y)?)$/i;
module.exports = exports.default;