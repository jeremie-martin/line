var r = require("./30.js");
var i = require("./134.js");
var o = require("./444.js");
var a = [].slice;
var s = /MSIE .\./.test(o);
function l(e) {
  return function (t, n) {
    var r = arguments.length > 2;
    var i = !!r && a.call(arguments, 2);
    return e(r ? function () {
      (typeof t == "function" ? t : Function(t)).apply(this, i);
    } : t, n);
  };
}
i(i.G + i.B + i.F * s, {
  setTimeout: l(r.setTimeout),
  setInterval: l(r.setInterval)
});