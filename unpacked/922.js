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
  d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"
});
function l(e) {
  return r.default.createElement(o.default, e, s);
}
(l = (0, i.default)(l)).muiName = "SvgIcon";
exports.default = l;