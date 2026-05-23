var r = require("./78.js");
module.exports = function (e, t) {
  if (!r(e)) {
    return e;
  }
  var n;
  var i;
  if (t && typeof (n = e.toString) == "function" && !r(i = n.call(e))) {
    return i;
  }
  if (typeof (n = e.valueOf) == "function" && !r(i = n.call(e))) {
    return i;
  }
  if (!t && typeof (n = e.toString) == "function" && !r(i = n.call(e))) {
    return i;
  }
  throw TypeError("Can't convert object to primitive value");
};