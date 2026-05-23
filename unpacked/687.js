function r(e) {}
module.exports = function (e, t, n, i, o, a, s, l) {
  r(t);
  if (!e) {
    var u;
    if (t === undefined) {
      u = new Error("Minified exception occurred; use the non-minified dev environment for the full error message and additional helpful warnings.");
    } else {
      var c = [n, i, o, a, s, l];
      var d = 0;
      (u = new Error(t.replace(/%s/g, function () {
        return c[d++];
      }))).name = "Invariant Violation";
    }
    u.framesToPop = 1;
    throw u;
  }
};