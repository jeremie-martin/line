Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e = "unnamed") {
  var t = arguments[1];
  var n = arguments[2];
  var a = n.jss;
  var s = (0, o.default)(t);
  var l = a.plugins.onCreateRule(e, s, n);
  if (l) {
    return l;
  }
  if (e[0] === "@") {
    (0, r.default)(false, "[JSS] Unknown at-rule %s", e);
  }
  return new i.default(e, s, n);
};
var r = a(require("./14.js"));
var i = a(require("./97.js"));
var o = a(require("./975.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}