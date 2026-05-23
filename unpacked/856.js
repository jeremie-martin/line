Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, t, n) {
  var u = "";
  var c = "";
  var d = t;
  if (typeof t == "string") {
    if (n === undefined) {
      return e.style[(0, r.default)(t)] || (0, o.default)(e).getPropertyValue((0, i.default)(t));
    }
    (d = {})[t] = n;
  }
  Object.keys(d).forEach(function (t) {
    var n = d[t];
    if (n || n === 0) {
      if ((0, l.default)(t)) {
        c += t + "(" + n + ") ";
      } else {
        u += (0, i.default)(t) + ": " + n + ";";
      }
    } else {
      (0, a.default)(e, (0, i.default)(t));
    }
  });
  if (c) {
    u += s.transform + ": " + c + ";";
  }
  e.style.cssText += ";" + u;
};
var r = u(require("./380.js"));
var i = u(require("./858.js"));
var o = u(require("./860.js"));
var a = u(require("./861.js"));
var s = require("./862.js");
var l = u(require("./863.js"));
function u(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
module.exports = exports.default;