var r = require("./423.js");
module.exports = function (e, t, n) {
  r(e);
  if (t === undefined) {
    return e;
  }
  switch (n) {
    case 1:
      return function (n) {
        return e.call(t, n);
      };
    case 2:
      return function (n, r) {
        return e.call(t, n, r);
      };
    case 3:
      return function (n, r, i) {
        return e.call(t, n, r, i);
      };
  }
  return function () {
    return e.apply(t, arguments);
  };
};