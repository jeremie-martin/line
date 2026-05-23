Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getNotificationsCount = exports.getNotificationProgressId = exports.getNotification = undefined;
var r = require("./17.js");
exports.getNotification = (0, r.createSelector)(e => e.notifications.message, e => e.notifications.autoHide, e => e.notifications.open, (e, t, n) => ({
  message: e,
  autoHide: t,
  open: n
}));
exports.getNotificationProgressId = e => e.notifications.progressId;
exports.getNotificationsCount = e => e.notifications.count;