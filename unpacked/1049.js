Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, {
  audioUrl: t,
  offset: n
}) {
  if (t) {
    t = t.replace("https://www.dropbox.com", "https://dl.dropboxusercontent.com");
    e.dispatch((0, i.getAudioFromURL)(t));
    if (n) {
      e.dispatch((0, r.setAudioOffset)(parseFloat(n)));
    }
  }
};
var r = require("./7.js");
var i = require("./110.js");
module.exports = exports.default;