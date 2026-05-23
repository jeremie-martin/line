Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = a(require("./0.js"));
var i = a(require("./33.js"));
var o = a(require("./23.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var s = r.default.createElement("path", {
  d: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2z"
});
function l(e) {
  return r.default.createElement(o.default, e, s);
}
(l = (0, i.default)(l)).muiName = "SvgIcon";
exports.default = l;