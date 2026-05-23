Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, t, n = i.default.render) {
  const a = (i => n(r.default.createElement(o.Provider, {
    store: e
  }, r.default.createElement(i, null)), t))(s);
  0;
  return a;
};
var r = a(require("./0.js"));
var i = a(require("./21.js"));
var o = require("./15.js");
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const s = require("./726.js");
module.exports = exports.default;