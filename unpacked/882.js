Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = s(require("./3.js"));
var i = s(require("./4.js"));
var o = s(require("./0.js"));
s(require("./1.js"));
var a = s(require("./37.js"));
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function l(e) {
  var t = e.raised;
  var n = (0, i.default)(e, ["raised"]);
  return o.default.createElement(a.default, (0, r.default)({
    elevation: t ? 8 : 2
  }, n));
}
l.propTypes = {};
l.defaultProps = {
  raised: false
};
exports.default = l;