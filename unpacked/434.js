var r = require("./192.js");
var i = require("./135.js");
var o = require("./79.js");
var a = require("./185.js");
var s = require("./51.js");
var l = require("./263.js");
var u = Object.getOwnPropertyDescriptor;
exports.f = require("./52.js") ? u : function (e, t) {
  e = o(e);
  t = a(t, true);
  if (l) {
    try {
      return u(e, t);
    } catch (e) {}
  }
  if (s(e, t)) {
    return i(!r.f.call(e, t), e[t]);
  }
};