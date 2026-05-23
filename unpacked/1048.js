Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = require("./34.js");
var i = require("./149.js");
var o = require("./7.js");
var a = require("./8.js");
var s = function (e) {
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
}(require("./27.js"));
var l = require("./109.js");
var u = require("./55.js");
function c(e = 250) {
  return new Promise(t => {
    if (document.visibilityState === "hidden") {
      document.addEventListener("visibilitychange", function n() {
        if (document.visibilityState === "visible") {
          setTimeout(() => {
            document.removeEventListener("visibilitychange", n);
            t();
          }, e);
        }
      });
    } else {
      t();
    }
  });
}
exports.default = async function (e, {
  key: t,
  masterKey: n,
  trackUrl: d
}) {
  let f;
  let p = (0, r.delay)(1000);
  let h = new Promise(t => {
    if ((0, a.isAudioFileLoading)(e.getState())) {
      let n = e.subscribe(() => {
        if (!(0, a.isAudioFileLoading)(e.getState())) {
          n();
          t("loadedAudio");
        }
      });
    } else {
      t("loadedAudio");
    }
  });
  let m = /\/(view|edit)\/(.*)\/.*/g.exec(window.location.pathname);
  if (d) {
    d = d.replace("https://www.dropbox.com", "https://dl.dropboxusercontent.com");
    e.dispatch((0, o.setTool)(s.PAN_TOOL));
    e.dispatch((0, o.enterEditableViewer)(true));
    f = e.dispatch((0, i.loadTrackFromServer)({
      cloudInfo: {}
    }, d));
  } else if (m != null) {
    let n = m[2];
    e.dispatch((0, u.setTrackDetails)(document.title.replace(" - Line Rider", "")));
    e.dispatch((0, o.setTool)(s.PAN_TOOL));
    if (t) {
      e.dispatch((0, o.enterEditableViewer)(true));
      f = e.dispatch((0, i.loadTrackFromServer)({
        cloudInfo: {
          versionId: n,
          derivativeKey: t
        }
      }));
    } else {
      e.dispatch((0, o.enterViewer)(true));
      f = e.dispatch((0, i.loadTrackFromServer)({
        cloudInfo: {
          versionId: n
        }
      }));
    }
  }
  if (f) {
    Promise.race([f, h]).then(t => {
      if (t !== "loadedAudio") {
        e.dispatch((0, l.setTrackLoaderProgress)("Loading audio...", true));
        h.then(() => {
          e.dispatch((0, l.setTrackLoaderProgressDone)());
        });
      }
    });
    if (await f) {
      await Promise.all([p, c(1000), h]);
      if (window.unlockAudioContext) {
        e.dispatch((0, l.setTrackLoaderProgress)("Click anywhere to continue.", 100));
        await window.unlockAudioContext;
      }
      e.dispatch((0, o.closeLoadScreen)(true));
      e.dispatch((0, o.openInfoSidebar)(true));
      await Promise.all([(0, r.delay)(1000), c(1000)]);
      e.dispatch((0, o.closeSidebar)(true));
      await (0, r.delay)(250);
      e.dispatch((0, o.setPlayerRunning)(true));
      e.dispatch((0, o.setPlayerStopAtEnd)(true));
      await new Promise(t => {
        let n = e.subscribe(() => {
          if (!(0, a.getPlayerRunning)(e.getState())) {
            n();
            t();
          }
        });
      });
    }
  }
};
module.exports = exports.default;