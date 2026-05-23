var r = require("./1018.js");
module.exports = function () {
  var e = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var t = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var n = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  var i = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var o = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var a = ["AM", "PM"];
  var s = ["am", "pm"];
  var l = ["a.m.", "p.m."];
  var u = {
    MMM: function (t) {
      return e[t.getMonth()];
    },
    MMMM: function (e) {
      return t[e.getMonth()];
    },
    dd: function (e) {
      return n[e.getDay()];
    },
    ddd: function (e) {
      return i[e.getDay()];
    },
    dddd: function (e) {
      return o[e.getDay()];
    },
    A: function (e) {
      if (e.getHours() / 12 >= 1) {
        return a[1];
      } else {
        return a[0];
      }
    },
    a: function (e) {
      if (e.getHours() / 12 >= 1) {
        return s[1];
      } else {
        return s[0];
      }
    },
    aa: function (e) {
      if (e.getHours() / 12 >= 1) {
        return l[1];
      } else {
        return l[0];
      }
    }
  };
  ["M", "D", "DDD", "d", "Q", "W"].forEach(function (e) {
    u[e + "o"] = function (t, n) {
      return function (e) {
        var t = e % 100;
        if (t > 20 || t < 10) {
          switch (t % 10) {
            case 1:
              return e + "st";
            case 2:
              return e + "nd";
            case 3:
              return e + "rd";
          }
        }
        return e + "th";
      }(n[e](t));
    };
  });
  return {
    formatters: u,
    formattingTokensRegExp: r(u)
  };
};