var e = require("./18.js");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.install = function () {
  (function () {
    if (n.prototype.hasOwnProperty("copyFromChannel")) {
      return;
    }
    n.prototype.copyFromChannel = function (e, t, n) {
      var r = this.getChannelData(t | 0).subarray(n | 0);
      e.set(r.subarray(0, Math.min(r.length, e.length)));
    };
  })();
  (function () {
    if (n.prototype.hasOwnProperty("copyToChannel")) {
      return;
    }
    n.prototype.copyToChannel = function (e, t, n) {
      var r = e.subarray(0, Math.min(e.length, this.length - (n | 0)));
      this.getChannelData(t | 0).set(r, n | 0);
    };
  })();
};
var n = e.AudioBuffer;