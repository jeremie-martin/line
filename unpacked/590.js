var e = require("./18.js");
var t = require("./194.js");
(function (e, n) {
  "use strict";

  if (!e.setImmediate) {
    var r;
    var i;
    var o;
    var a;
    var s;
    var l = 1;
    var u = {};
    var c = false;
    var d = e.document;
    var f = Object.getPrototypeOf && Object.getPrototypeOf(e);
    f = f && f.setTimeout ? f : e;
    if ({}.toString.call(e.process) === "[object process]") {
      r = function (e) {
        t.nextTick(function () {
          h(e);
        });
      };
    } else if (!function () {
      if (e.postMessage && !e.importScripts) {
        var t = true;
        var n = e.onmessage;
        e.onmessage = function () {
          t = false;
        };
        e.postMessage("", "*");
        e.onmessage = n;
        return t;
      }
    }()) {
      if (e.MessageChannel) {
        (o = new MessageChannel()).port1.onmessage = function (e) {
          h(e.data);
        };
        r = function (e) {
          o.port2.postMessage(e);
        };
      } else if (d && "onreadystatechange" in d.createElement("script")) {
        i = d.documentElement;
        r = function (e) {
          var t = d.createElement("script");
          t.onreadystatechange = function () {
            h(e);
            t.onreadystatechange = null;
            i.removeChild(t);
            t = null;
          };
          i.appendChild(t);
        };
      } else {
        r = function (e) {
          setTimeout(h, 0, e);
        };
      }
    } else {
      a = "setImmediate$" + Math.random() + "$";
      s = function (t) {
        if (t.source === e && typeof t.data == "string" && t.data.indexOf(a) === 0) {
          h(+t.data.slice(a.length));
        }
      };
      if (e.addEventListener) {
        e.addEventListener("message", s, false);
      } else {
        e.attachEvent("onmessage", s);
      }
      r = function (t) {
        e.postMessage(a + t, "*");
      };
    }
    f.setImmediate = function (e) {
      if (typeof e != "function") {
        e = new Function("" + e);
      }
      for (var t = new Array(arguments.length - 1), n = 0; n < t.length; n++) {
        t[n] = arguments[n + 1];
      }
      var i = {
        callback: e,
        args: t
      };
      u[l] = i;
      r(l);
      return l++;
    };
    f.clearImmediate = p;
  }
  function p(e) {
    delete u[e];
  }
  function h(e) {
    if (c) {
      setTimeout(h, 0, e);
    } else {
      var t = u[e];
      if (t) {
        c = true;
        try {
          (function (e) {
            var t = e.callback;
            var r = e.args;
            switch (r.length) {
              case 0:
                t();
                break;
              case 1:
                t(r[0]);
                break;
              case 2:
                t(r[0], r[1]);
                break;
              case 3:
                t(r[0], r[1], r[2]);
                break;
              default:
                t.apply(n, r);
            }
          })(t);
        } finally {
          p(e);
          c = false;
        }
      }
    }
  }
})(typeof self == "undefined" ? e === undefined ? this : e : self);