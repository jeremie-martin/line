Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.renderer = undefined;
var r;
var i = require("./180.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
exports.renderer = new class extends o.default.Renderer {
  link(e, t, n) {
    return `<a href="${e}" target="_blank" ${t ? `title="${t}"` : ""}>${n}</a>`;
  }
}();