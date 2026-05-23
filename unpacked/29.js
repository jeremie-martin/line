Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = "notifications/";
const i = exports.SHOW_NOTIFICATION = r + "SHOW_NOTIFICATION";
const o = exports.HIDE_NOTIFICATION = r + "HIDE_NOTIFICATION";
exports.showNotification = (e, t = true, n) => ({
  type: i,
  payload: {
    message: e,
    autoHide: t,
    progressId: n
  }
});
exports.hideNotification = e => ({
  type: o,
  payload: e
});