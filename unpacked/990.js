Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = p(require("./991.js"));
var i = p(require("./346.js"));
var o = p(require("./993.js"));
var a = p(require("./347.js"));
var s = p(require("./994.js"));
var l = p(require("./995.js"));
var u = p(require("./348.js"));
var c = p(require("./997.js"));
var d = p(require("./349.js"));
var f = p(require("./351.js"));
function p(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = function (e = {}) {
  return {
    plugins: [(0, r.default)(e.template), (0, i.default)(e.global), (0, o.default)(e.extend), (0, a.default)(e.nested), (0, s.default)(e.compose), (0, l.default)(e.camelCase), (0, u.default)(e.defaultUnit), (0, c.default)(e.expand), (0, d.default)(e.vendorPrefixer), (0, f.default)(e.propsSort)]
  };
};