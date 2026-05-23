Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.setupRareNotifications = function (e) {
  e.subscribe(() => u(e));
  u(e);
};
var r = s(require("./723.js"));
var i = s(require("./111.js"));
var o = require("./29.js");
var a = require("./8.js");
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
let l = [{
  id: "iePerf 2017-11-16",
  message: "Line Rider has known performance issues on IE - try using Chrome, Firefox or Edge",
  interval: (0, r.default)("1 hour"),
  condition: e => (0, a.getInEditor)(e),
  userAgents: [/(trident).+rv[:\s]([\w\.]+).+like\sgecko/i, /(?:ms|\()(ie)\s([\w\.]+)/i, /(avant\s|iemobile|slim|baidu)(?:browser)?[\/\s]?([\w\.]*)/i]
}];
function u({
  getState: e,
  dispatch: t
}) {
  for (let s = 0; s < l.length; ++s) {
    let u = l[s];
    let c = "notification: " + u.id;
    let d = true;
    if (i.default.getItem(c)) {
      var n = parseFloat(i.default.getItem(c));
      if (Date.now() - n < u.interval) {
        d = "never";
      }
    }
    if (d != "never" && u.userAgents) {
      var r = false;
      for (let e of u.userAgents) {
        if (e.test(navigator.userAgent)) {
          r = true;
        }
      }
      if (!r) {
        d = "never";
      }
    }
    if (d !== "never") {
      d = u.condition(e());
    }
    var a = false;
    if (d === true) {
      a = true;
      i.default.setItem(c, "" + Date.now());
      d = "never";
    }
    if (d === "never") {
      l.splice(s, 1);
      --s;
    }
    if (a) {
      t((0, o.showNotification)(u.message, false));
    }
  }
}