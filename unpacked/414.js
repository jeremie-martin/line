Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Colors = undefined;
exports.default = function (e) {
  (0, r.setCustomRiders)(r.setCustomRiders.default, e);
};
var r = require("./298.js");
const i = exports.Colors = ["#FD4F38", "#06A725", "#3995FD", "#FFD54B", "#62DAD4", "#D171DF"];
r.setCustomRiders.default = ["", ...i.map(e => `.flag { fill: ${e}; opacity: 0.4; } .scarfOdd { fill: ${e}; }`)];