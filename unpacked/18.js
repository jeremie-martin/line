var n;
n = function () {
  return this;
}();
try {
  n = n || new Function("return this")();
} catch (e) {
  if (typeof window == "object") {
    n = window;
  }
}
module.exports = n;