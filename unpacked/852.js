Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e) {
  var t = (0, o.default)(e);
  return t && t.defaultView || t.parentWindow;
};
var r;
var i = require("./62.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
module.exports = exports.default;