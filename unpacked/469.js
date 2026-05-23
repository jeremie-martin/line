var n = new Float32Array(4096);
var r = new Float32Array(4096);
(function () {
  var e;
  for (e = 0; e < 4096; e++) {
    n[e] = Math.cos(e / 4096 * Math.PI * 0.5);
    r[e] = Math.sin(e / 4096 * Math.PI * 0.5);
  }
})();
module.exports = {
  L: n,
  R: r
};