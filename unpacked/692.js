Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function (e) {
  return typeof e;
} : function (e) {
  if (e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype) {
    return "symbol";
  } else {
    return typeof e;
  }
};
exports.default = function e(t) {
  if (t == null) {
    return t;
  }
  var n = t === undefined ? "undefined" : r(t);
  if (n === "string" || n === "number" || n === "function") {
    return t;
  }
  if (s(t)) {
    return t.map(e);
  }
  if ((0, a.default)(t)) {
    return t;
  }
  var i = {};
  for (var o in t) {
    var l = t[o];
    if ((l === undefined ? "undefined" : r(l)) !== "object") {
      i[o] = l;
    } else {
      i[o] = e(l);
    }
  }
  return i;
};
var i;
var o = require("./341.js");
var a = (i = o) && i.__esModule ? i : {
  default: i
};
var s = Array.isArray;