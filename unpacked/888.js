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
  d: "M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
});
function l(e) {
  return r.default.createElement(o.default, e, s);
}
(l = (0, i.default)(l)).muiName = "SvgIcon";
exports.default = l;