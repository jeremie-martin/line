Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.controlsActive = undefined;
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
}(require("./139.js"));
var i = require("./7.js");
exports.controlsActive = (e = true, t) => {
  switch (t.type) {
    case r.SET_CONTROLS_ACTIVE:
      return t.payload;
    case r.TOGGLE_CONTROLS_ACTIVE:
      return !e;
    case i.STOP_PLAYER:
      return true;
    case i.SET_PLAYER_RUNNING:
      return !t.payload || e;
    default:
      return e;
  }
};