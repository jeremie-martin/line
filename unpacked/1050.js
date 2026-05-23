Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = function (e) {
  if (e && e.__esModule) {
    return e;
  }
  var t = {};
  if (e != null) {
    for (var n in e) {
      if (Object.prototype.hasOwnProperty.call(e, n)) {
        t[n] = e[n];
      }
    }
  }
  t.default = e;
  return t;
}(require("./210.js"));
var i = require("./108.js");
var o = require("./55.js");
var a = require("./29.js");
var s = require("./8.js");
exports.default = async function (e) {
  try {
    await r.open();
    let t = await r.listSavedTracks();
    e.dispatch((0, i.loadSavedTracks)(t));
  } catch (t) {
    e.dispatch((0, o.setLocalFile)(true));
    let n = e.subscribe(() => {
      if ((0, s.getInTrackLoader)(e.getState()) || (0, s.getInTrackSaver)(e.getState())) {
        n();
        e.dispatch((0, a.showNotification)("You will only be able to save tracks to file and you will not be able to access previously saved tracks.", false));
      }
    });
    switch (t.name) {
      case "QuotaExceededError":
        break;
      default:
        throw t;
    }
  }
};
module.exports = exports.default;