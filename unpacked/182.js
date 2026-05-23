module.exports = function (e, t, n, r, i, o, a, s) {
  if (!e) {
    var l;
    if (t === undefined) {
      l = new Error("Minified exception occurred; use the non-minified dev environment for the full error message and additional helpful warnings.");
    } else {
      var u = [n, r, i, o, a, s];
      var c = 0;
      (l = new Error(t.replace(/%s/g, function () {
        return u[c++];
      }))).name = "Invariant Violation";
    }
    l.framesToPop = 1;
    throw l;
  }
};