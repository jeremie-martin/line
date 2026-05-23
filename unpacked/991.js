Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./992.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
function a(e) {
  if (typeof e.style == "string") {
    e.style = (0, o.default)(e.style);
  }
}
exports.default = function () {
  return {
    onProcessRule: a
  };
};