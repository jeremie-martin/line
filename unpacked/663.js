var r = require("./49.js");
var i = require("./71.js");
function o(e, t) {
  i(e);
  if (!r(t) && t !== null) {
    throw TypeError(t + ": can't set as prototype!");
  }
}
module.exports = {
  set: Object.setPrototypeOf || ("__proto__" in {} ? function (e, t, r) {
    try {
      (r = require("./70.js")(Function.call, require("./328.js").f(Object.prototype, "__proto__").set, 2))(e, []);
      t = !(e instanceof Array);
    } catch (e) {
      t = true;
    }
    return function (e, n) {
      o(e, n);
      if (t) {
        e.__proto__ = n;
      } else {
        r(e, n);
      }
      return e;
    };
  }({}, false) : undefined),
  check: o
};