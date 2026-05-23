var e = require("./18.js");
var r = Function.prototype.apply;
function i(e, t) {
  this._id = e;
  this._clearFn = t;
}
exports.setTimeout = function () {
  return new i(r.call(setTimeout, window, arguments), clearTimeout);
};
exports.setInterval = function () {
  return new i(r.call(setInterval, window, arguments), clearInterval);
};
exports.clearTimeout = exports.clearInterval = function (e) {
  if (e) {
    e.close();
  }
};
i.prototype.unref = i.prototype.ref = function () {};
i.prototype.close = function () {
  this._clearFn.call(window, this._id);
};
exports.enroll = function (e, t) {
  clearTimeout(e._idleTimeoutId);
  e._idleTimeout = t;
};
exports.unenroll = function (e) {
  clearTimeout(e._idleTimeoutId);
  e._idleTimeout = -1;
};
exports._unrefActive = exports.active = function (e) {
  clearTimeout(e._idleTimeoutId);
  var t = e._idleTimeout;
  if (t >= 0) {
    e._idleTimeoutId = setTimeout(function () {
      if (e._onTimeout) {
        e._onTimeout();
      }
    }, t);
  }
};
require("./590.js");
exports.setImmediate = typeof self != "undefined" && self.setImmediate || e !== undefined && e.setImmediate || this && this.setImmediate;
exports.clearImmediate = typeof self != "undefined" && self.clearImmediate || e !== undefined && e.clearImmediate || this && this.clearImmediate;