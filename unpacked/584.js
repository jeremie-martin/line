var n = 9007199254740991;
var r = /^(?:0|[1-9]\d*)$/;
module.exports = function (e, t) {
  return !!(t = t == null ? n : t) && (typeof e == "number" || r.test(e)) && e > -1 && e % 1 == 0 && e < t;
};