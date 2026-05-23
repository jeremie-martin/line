var r = require("./49.js");
var i = require("./326.js");
var o = require("./31.js")("species");
module.exports = function (e) {
  var t;
  if (i(e)) {
    if (typeof (t = e.constructor) == "function" && (t === Array || !!i(t.prototype))) {
      t = undefined;
    }
    if (r(t) && (t = t[o]) === null) {
      t = undefined;
    }
  }
  if (t === undefined) {
    return Array;
  } else {
    return t;
  }
};