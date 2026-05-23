var r = require("./647.js")(true);
require("./226.js")(String, "String", function (e) {
  this._t = String(e);
  this._i = 0;
}, function () {
  var e;
  var t = this._t;
  var n = this._i;
  if (n >= t.length) {
    return {
      value: undefined,
      done: true
    };
  } else {
    e = r(t, n);
    this._i += e.length;
    return {
      value: e,
      done: false
    };
  }
});