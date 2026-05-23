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
}(require("./304.js"));
var i = require("./108.js");
var o = require("./29.js");
var a = require("./8.js");
exports.default = async function (e) {
  function t(t) {
    let n = e.subscribe(() => {
      if ((0, a.getInEditor)(e.getState())) {
        n();
        e.dispatch((0, o.showNotification)(t, false));
        e.dispatch((0, i.setAutosaveEnabled)(false));
      }
    });
  }
  try {
    await r.open();
  } catch (e) {
    t("Autosave is disabled and you will receive an exit confirmation prompt if you exit with an unsaved track.");
    switch (e.name) {
      case "QuotaExceededError":
        return;
      default:
        throw e;
    }
  }
  {
    let e = new window.BroadcastChannel("autosaveSync");
    e.postMessage("opened");
    e.onmessage = n => {
      switch (n.data) {
        case "primaryExists":
          e.onmessage = null;
          t("Because another window is open, autosave is disabled and you will receive an exit confirmation prompt if you exit with an unsaved track.");
          break;
        case "opened":
          e.postMessage("primaryExists");
          break;
        default:
          throw new Error(`Unknown message: ${n.data}`);
      }
    };
  }
};
module.exports = exports.default;