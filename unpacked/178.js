Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, t = false) {
  if (!Array.isArray(e)) {
    return e;
  }
  var n = "";
  if (Array.isArray(e[0])) {
    for (var i = 0; i < e.length && e[i] !== "!important"; i++) {
      if (n) {
        n += ", ";
      }
      n += r(e[i], " ");
    }
  } else {
    n = r(e, ", ");
  }
  if (!t && e[e.length - 1] === "!important") {
    n += " !important";
  }
  return n;
};
function r(e, t) {
  var n = "";
  for (var r = 0; r < e.length && e[r] !== "!important"; r++) {
    if (n) {
      n += t;
    }
    n += e[r];
  }
  return n;
}