var r = require("./71.js");
module.exports = function (e, t, n, i) {
  try {
    if (i) {
      return t(r(n)[0], n[1]);
    } else {
      return t(n);
    }
  } catch (t) {
    var o = e.return;
    if (o !== undefined) {
      r(o.call(e));
    }
    throw t;
  }
};