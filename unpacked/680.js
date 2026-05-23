var r = require("./28.js");
module.exports = function (e) {
  r(r.S, e, {
    of: function () {
      for (var e = arguments.length, t = new Array(e); e--;) {
        t[e] = arguments[e];
      }
      return new this(t);
    }
  });
};