Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = s(require("./591.js"));
var i = require("./592.js");
var o = s(i);
var a = s(require("./594.js"));
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var l = null;
l = (0, r.default)("localStorage") ? window.localStorage : (0, r.default)("sessionStorage") ? window.sessionStorage : (0, i.hasCookies)() ? new o.default() : new a.default();
exports.default = l;