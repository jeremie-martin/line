var r;
(function () {
  "use strict";

  var n = {}.hasOwnProperty;
  function i() {
    var e = [];
    for (var t = 0; t < arguments.length; t++) {
      var r = arguments[t];
      if (r) {
        var o = typeof r;
        if (o === "string" || o === "number") {
          e.push(r);
        } else if (Array.isArray(r)) {
          e.push(i.apply(null, r));
        } else if (o === "object") {
          for (var a in r) {
            if (n.call(r, a) && r[a]) {
              e.push(a);
            }
          }
        }
      }
    }
    return e.join(" ");
  }
  if (module.exports) {
    module.exports = i;
  } else if ((r = function () {
    return i;
  }.apply(exports, [])) !== undefined) {
    module.exports = r;
  }
})();