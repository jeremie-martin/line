require("./138.js")("search", 1, function (e, t, n) {
  return [function (n) {
    "use strict";

    var r = e(this);
    var i = n == undefined ? undefined : n[t];
    if (i !== undefined) {
      return i.call(n, r);
    } else {
      return new RegExp(n)[t](String(r));
    }
  }, n];
});