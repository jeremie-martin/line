var t = require("./18.js");
var r = require("./460.js");
var i = typeof window == "undefined" ? t : window;
for (var o = ["moz", "webkit"], a = "AnimationFrame", s = i["request" + a], l = i["cancel" + a] || i["cancelRequest" + a], u = 0; !s && u < o.length; u++) {
  s = i[o[u] + "Request" + a];
  l = i[o[u] + "Cancel" + a] || i[o[u] + "CancelRequest" + a];
}
if (!s || !l) {
  var c = 0;
  var d = 0;
  var f = [];
  s = function (e) {
    if (f.length === 0) {
      var t = r();
      var n = Math.max(0, 1000 / 60 - (t - c));
      c = n + t;
      setTimeout(function () {
        var e = f.slice(0);
        f.length = 0;
        for (var t = 0; t < e.length; t++) {
          if (!e[t].cancelled) {
            try {
              e[t].callback(c);
            } catch (e) {
              setTimeout(function () {
                throw e;
              }, 0);
            }
          }
        }
      }, Math.round(n));
    }
    f.push({
      handle: ++d,
      callback: e,
      cancelled: false
    });
    return d;
  };
  l = function (e) {
    for (var t = 0; t < f.length; t++) {
      if (f[t].handle === e) {
        f[t].cancelled = true;
      }
    }
  };
}
module.exports = function (e) {
  return s.call(i, e);
};
module.exports.cancel = function () {
  l.apply(i, arguments);
};
module.exports.polyfill = function () {
  i.requestAnimationFrame = s;
  i.cancelAnimationFrame = l;
};