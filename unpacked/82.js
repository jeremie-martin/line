var t = require("./18.js");
var r = require("./507.js");
var i = typeof window != "undefined" ? window : t !== undefined ? t : typeof self != "undefined" ? self : {};
var o = i.Raven;
var a = new r();
a.noConflict = function () {
  i.Raven = o;
  return a;
};
a.afterLoad();
module.exports = a;
module.exports.Client = r;