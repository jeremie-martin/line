Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getFormattedDateTime = exports.getFormattedDate = undefined;
var r;
var i = require("./1006.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
exports.getFormattedDate = e => (0, o.default)(e * 1000, "MMMM DD, YYYY");
exports.getFormattedDateTime = e => (0, o.default)(e * 1000, "MMM Do YYYY, h:mm a");