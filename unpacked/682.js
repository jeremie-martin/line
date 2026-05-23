var r = require("./28.js");
var i = require("./318.js");
var o = require("./70.js");
var a = require("./158.js");
module.exports = function (e) {
  r(r.S, e, {
    from: function (e) {
      var t;
      var n;
      var r;
      var s;
      var l = arguments[1];
      i(this);
      if (t = l !== undefined) {
        i(l);
      }
      if (e == undefined) {
        return new this();
      } else {
        n = [];
        if (t) {
          r = 0;
          s = o(l, arguments[2], 2);
          a(e, false, function (e) {
            n.push(s(e, r++));
          });
        } else {
          a(e, false, n.push, n);
        }
        return new this(n);
      }
    }
  });
};