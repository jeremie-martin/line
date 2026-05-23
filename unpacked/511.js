var r = require("./200.js");
module.exports = {
  wrapMethod: function (e, t, n) {
    var i = e[t];
    var o = e;
    if (t in e) {
      var a = t === "warn" ? "warning" : t;
      e[t] = function () {
        var e = [].slice.call(arguments);
        var s = r.safeJoin(e, " ");
        var l = {
          level: a,
          logger: "console",
          extra: {
            arguments: e
          }
        };
        if (t === "assert") {
          if (e[0] === false) {
            s = "Assertion failed: " + (r.safeJoin(e.slice(1), " ") || "console.assert");
            l.extra.arguments = e.slice(1);
            if (n) {
              n(s, l);
            }
          }
        } else if (n) {
          n(s, l);
        }
        if (i) {
          Function.prototype.apply.call(i, o, e);
        }
      };
    }
  }
};