Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.passiveOption = undefined;
var r;
var i = require("./224.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
var a;
a = null;
exports.passiveOption = function () {
  if (a !== null) {
    return a;
  }
  var e;
  var t;
  var n;
  var r = false;
  try {
    window.addEventListener("test", null, (e = {}, t = "passive", n = {
      get: function () {
        r = true;
      }
    }, (0, o.default)(e, t, n)));
  } catch (e) {}
  a = r;
  return r;
}();
exports.default = {};