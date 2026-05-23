Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.saveTrack = exports.quicksave = undefined;
var r;
var i = require("./313.js");
var o = require("./82.js");
var a = (r = o) && r.__esModule ? r : {
  default: r
};
v(require("./307.js"));
var s = require("./34.js");
var l = require("./8.js");
var u = require("./55.js");
var c = require("./109.js");
var d = require("./7.js");
var f = v(require("./210.js"));
var p = require("./108.js");
var h = require("./211.js");
var m = require("./151.js");
var y = require("./29.js");
var g = require("./214.js");
function v(e) {
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
}
exports.quicksave = () => async function (e, t) {
  let n = (0, l.getTrackDetails)(t());
  let r = (0, l.getTrackIsLocalFile)(t());
  let i = (0, l.getTrackCloudInfo)(t());
  if (!(0, m.getTrackSaverInProgress)(t())) {
    if ((0, l.getTrackIsEmpty)(t())) {
      e((0, y.showNotification)("There is nothing to save!"));
    } else if ((0, l.getTrackIsDirty)(t())) {
      if (n.title === "" || !r && !i) {
        e((0, d.openTrackSaver)());
      } else {
        e((0, y.showNotification)("Saving...", false, d.SAVE_TRACK));
        await e(b(n));
        e((0, y.hideNotification)("Saving..."));
        e((0, y.showNotification)("Save complete."));
      }
    } else {
      e((0, y.showNotification)("There aren't any changes to save!"));
    }
  }
};
const b = exports.saveTrack = e => async function (t, n) {
  let r = (0, l.getTrackIsLocalFile)(n());
  let o = (0, l.getTrackCloudInfo)(n());
  t(r ? (0, g.analyticsSaveTrackFile)() : (0, g.analyticsSaveTrack)());
  t((0, c.setTrackSaverProgress)("Preparing data...", 0));
  await (0, s.animationFrame)();
  let m = (0, l.getTrackObjectForSaving)(n(), e);
  if (r) {
    let n = await (0, h.trackJsonStringify)(m, async function (e) {
      t((0, c.setTrackSaverProgress)("Serializing...", e * 25));
      await (0, s.animationFrame)();
    });
    t((0, c.setTrackSaverProgress)("Converting...", 75));
    await (0, s.animationFrame)();
    let r = new window.Blob([n], {
      type: "application/octet-stream"
    });
    t((0, c.setTrackSaverProgress)("Downloading...", 100));
    await (0, s.animationFrame)();
    (0, i.saveAs)(r, e.title + ".track.json");
    t((0, u.setTrackDetails)(e.title, e.creator, e.description));
  } else {
    const n = Object.assign({}, m, {
      lines: m.lines.map(e => e.toJSON()),
      layers: m.layers.map(e => e.toJSON())
    });
    const r = {
      details: e,
      cloudInfo: {
        trackId: o && o.trackId || Date.now(),
        saveTime: Date.now() / 1000
      },
      local: true
    };
    t((0, u.setTrackDetails)(e.title, e.creator, e.description, r.cloudInfo));
    try {
      await f.putLocalTrack(r, n);
    } catch (e) {
      switch (e.name) {
        case "QuotaExceededError":
          alert("You have no more space in your device!");
          t((0, c.setTrackSaverProgressFail)());
          return false;
        default:
          alert(`Failed to save! ${e.name}: ${e.message}`);
          a.default.captureException(e);
          t((0, c.setTrackSaverProgressFail)());
          return false;
      }
    }
    t((0, p.putSavedTrack)(r));
  }
  t((0, d.saveTrackAction)());
  t((0, c.setTrackSaverProgressDone)());
  return true;
};