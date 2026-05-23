require("./138.js")("replace", 2, function (e, t, n) {
  return [function (r, i) {
    "use strict";

    var o = e(this);
    var a = r == undefined ? undefined : r[t];
    if (a !== undefined) {
      return a.call(r, o, i);
    } else {
      return n.call(String(o), r, i);
    }
  }, n];
});