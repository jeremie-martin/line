var t = require("./194.js");
(function () {
  var n;
  var r;
  var i;
  if (typeof performance != "undefined" && performance !== null && performance.now) {
    module.exports = function () {
      return performance.now();
    };
  } else if (t !== undefined && t !== null && t.hrtime) {
    module.exports = function () {
      return (n() - i) / 1000000;
    };
    r = t.hrtime;
    i = (n = function () {
      var e;
      return (e = r())[0] * 1000000000 + e[1];
    })();
  } else if (Date.now) {
    module.exports = function () {
      return Date.now() - i;
    };
    i = Date.now();
  } else {
    module.exports = function () {
      return new Date().getTime() - i;
    };
    i = new Date().getTime();
  }
}).call(this);