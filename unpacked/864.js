Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isBody = a;
exports.default = function (e) {
  var t = (0, i.default)(e);
  var n = (0, r.default)(t);
  if (!n && !a(e)) {
    return e.scrollHeight > e.clientHeight;
  }
  var o = window.getComputedStyle(t.body);
  var s = parseInt(o.getPropertyValue("margin-left"), 10);
  var l = parseInt(o.getPropertyValue("margin-right"), 10);
  return s + t.body.clientWidth + l < n.innerWidth;
};
var r = o(require("./865.js"));
var i = o(require("./62.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function a(e) {
  return e && e.tagName.toLowerCase() === "body";
}