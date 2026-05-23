var r = require("./154.js");
var i = require("./117.js");
var o = require("./85.js");
var a = require("./222.js");
var s = require("./69.js");
var l = require("./319.js");
var u = Object.getOwnPropertyDescriptor;
exports.f = require("./42.js") ? u : function (e, t) {
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