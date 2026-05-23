Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./14.js"));
o(require("./344.js"));
var i = o(require("./694.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = function () {
  var e = 0;
  return function (t, n) {
    if ((e += 1) > 10000000000) {
      (0, r.default)(false, "[JSS] You might have a memory leak. Rule counter is at %s.", e);
    }
    var o = "c";
    var a = "";
    if (n) {
      o = n.options.classNamePrefix || "c";
      if (n.options.jss.id != null) {
        a += n.options.jss.id;
      }
    }
    return "" + o + i.default + a + e;
  };
};