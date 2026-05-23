var r;
var i;
var o;
var a = require("./264.js");
var s = require("./447.js");
var l = require("./270.js");
var u = require("./184.js");
var c = require("./30.js");
var d = c.process;
var f = c.setImmediate;
var p = c.clearImmediate;
var h = c.MessageChannel;
var m = c.Dispatch;
var y = 0;
var g = {};
function v() {
  var e = +this;
  if (g.hasOwnProperty(e)) {
    var t = g[e];
    delete g[e];
    t();
  }
}
function b(e) {
  v.call(e.data);
}
if (!f || !p) {
  f = function (e) {
    var t = [];
    for (var n = 1; arguments.length > n;) {
      t.push(arguments[n++]);
    }
    g[++y] = function () {
      s(typeof e == "function" ? e : Function(e), t);
    };
    r(y);
    return y;
  };
  p = function (e) {
    delete g[e];
  };
  if (require("./137.js")(d) == "process") {
    r = function (e) {
      d.nextTick(a(v, e, 1));
    };
  } else if (m && m.now) {
    r = function (e) {
      m.now(a(v, e, 1));
    };
  } else if (h) {
    o = (i = new h()).port2;
    i.port1.onmessage = b;
    r = a(o.postMessage, o, 1);
  } else if (c.addEventListener && typeof postMessage == "function" && !c.importScripts) {
    r = function (e) {
      c.postMessage(e + "", "*");
    };
    c.addEventListener("message", b, false);
  } else {
    r = "onreadystatechange" in u("script") ? function (e) {
      l.appendChild(u("script")).onreadystatechange = function () {
        l.removeChild(this);
        v.call(e);
      };
    } : function (e) {
      setTimeout(a(v, e, 1), 0);
    };
  }
}
module.exports = {
  set: f,
  clear: p
};