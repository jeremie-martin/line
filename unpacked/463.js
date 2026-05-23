var e = require("./18.js");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.install = function () {
  (function () {
    if (n.prototype.hasOwnProperty("getFloatTimeDomainData")) {
      return;
    }
    var e = new Uint8Array(2048);
    n.prototype.getFloatTimeDomainData = function (t) {
      this.getByteTimeDomainData(e);
      for (var n = 0, r = t.length; n < r; n++) {
        t[n] = (e[n] - 128) * 0.0078125;
      }
    };
  })();
};
var n = e.AnalyserNode;