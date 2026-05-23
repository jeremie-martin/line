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
  d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
});
function l(e) {
  return r.default.createElement(o.default, e, s);
}
(l = (0, i.default)(l)).muiName = "SvgIcon";
exports.default = l;