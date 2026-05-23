var r = require("./18.js");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function () {
  var e = arguments[0] === undefined ? Infinity : arguments[0];
  if (!r.hasOwnProperty("AudioContext") && r.hasOwnProperty("webkitAudioContext")) {
    r.AudioContext = r.webkitAudioContext;
  }
  if (!r.hasOwnProperty("OfflineAudioContext") && r.hasOwnProperty("webkitOfflineAudioContext")) {
    r.OfflineAudioContext = r.webkitOfflineAudioContext;
  }
  if (!r.AudioContext) {
    return;
  }
  require("./463.js").install(e);
  require("./464.js").install(e);
  require("./465.js").install(e);
  require("./466.js").install(e);
};
module.exports = exports.default;