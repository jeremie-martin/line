var r = require("./53.js");
var i = require("./101.js");
var o = require("./99.js");
var a = require("./189.js");
var s = require("./47.js");
module.exports = function (e, t, n) {
  var l = s(e);
  var u = n(a, l, ""[e]);
  var c = u[0];
  var d = u[1];
  if (o(function () {
    var t = {
      [l]: function () {
        return 7;
      }
    };
    return ""[e](t) != 7;
  })) {
    i(String.prototype, e, c);
    r(RegExp.prototype, l, t == 2 ? function (e, t) {
      return d.call(e, this, t);
    } : function (e) {
      return d.call(e, this);
    });
  }
};