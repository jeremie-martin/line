var r = require("./953.js");
var i = r.requestAnimationFrame || r.webkitRequestAnimationFrame || r.mozRequestAnimationFrame || function (e) {
  var t = +new Date();
  var n = Math.max(0, 16 - (t - o));
  var r = setTimeout(e, n);
  o = t;
  return r;
};
var o = +new Date();
var a = r.cancelAnimationFrame || r.webkitCancelAnimationFrame || r.mozCancelAnimationFrame || clearTimeout;
if (Function.prototype.bind) {
  i = i.bind(r);
  a = a.bind(r);
}
(module.exports = i).cancel = a;