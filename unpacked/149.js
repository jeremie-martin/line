Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.loadTrackFromString = exports.loadTrackFromAutosave = exports.loadTrackFromServer = exports.loadTrackFile = exports.removeTrack = undefined;
var r = f(require("./210.js"));
var i = f(require("./307.js"));
var o = require("./108.js");
var a = require("./34.js");
var s = require("./109.js");
var l = require("./7.js");
var u = require("./8.js");
var c = require("./55.js");
var d = require("./211.js");
function f(e) {
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
exports.removeTrack = e => async function (t) {
  if (confirm("Remove this track?")) {
    let n = await r.removeSavedTrack(e);
    t((0, o.removeSavedTrack)(e));
    if (!n) {
      console.warn("failed to remove track", e);
    }
  }
};
const p = (e, {
  localFile: t
} = {}) => async function (n) {
  try {
    let r = await e;
    if (r.localFile == null) {
      r.localFile = t;
    }
    await n(((e, {
      precompute: t = false
    } = {}) => async function (n, r) {
      let i = e.lines;
      e.lines = [];
      n((0, l.loadTrackAction)(e));
      for (let e = 0; e < i.length; e += 2500) {
        n((0, s.setTrackLoaderProgress)("Loading track...", 50 + e * 25 / i.length * (t ? 1 : 2)));
        await (0, a.animationFrame)();
        n((0, l.loadLines)(i.slice(e, e + 2500)));
      }
      if (t && e.duration != null) {
        let t = Math.ceil(e.duration);
        n((0, s.setTrackLoaderProgress)("Precomputing physics...", 75));
        await (0, a.animationFrame)();
        const i = 2400;
        for (let e = 0; e < t; e += i) {
          let o = Math.min(e + i, t);
          n((0, s.setTrackLoaderProgress)("Precomputing physics...", 75 + o * 25 / t));
          await (0, a.animationFrame)();
          (0, u.getSimulatorTrack)(r()).getRider(o);
        }
      }
    })(r, {
      precompute: window.precompute
    }));
  } catch (e) {
    n((0, s.setTrackLoaderProgressFail)(e));
    await (0, a.animationFrame)();
    alert(e.message);
    return false;
  }
  n((0, s.setTrackLoaderProgressDone)());
  return true;
};
const h = "Are you sure you want to load a track? You have unsaved changes.";
exports.loadTrackFile = e => async function (t, n) {
  if ((0, u.getTrackIsDirty)(n())) {
    if (!confirm(h)) {
      return;
    }
  }
  let r = (0, d.readTrackFile)(e, {
    getTrackIndex: e => prompt("Enter the index of the track to load:\n\nindex, version, line count, label\n\n" + e.map((e, t) => [t, e.version, e.lines.length, e.label].join("\t\t")).join("\n")),
    onReadProgress(e) {
      t((0, s.setTrackLoaderProgress)("Reading file...", e / 4));
    },
    async onBeforeParse() {
      t((0, s.setTrackLoaderProgress)("Parsing file...", 25));
      await (0, a.animationFrame)();
      await (0, a.animationFrame)();
    }
  });
  return await t(p(r, {
    localFile: true
  }));
};
exports.loadTrackFromServer = (e, t) => async function (n, o) {
  if ((0, u.getTrackIsDirty)(o())) {
    if (!confirm(h)) {
      return;
    }
  }
  let l;
  if (e.local) {
    n((0, s.setTrackLoaderProgress)("Loading...", 0));
    l = r.getLocalTrack(e);
  } else {
    n((0, s.setTrackLoaderProgress)("Waiting for server...", 0));
    l = i.loadTrack(e, {
      route: t,
      onDownloadProgress(e) {
        n((0, s.setTrackLoaderProgress)("Downloading track...", e * 100 / 6));
      },
      onReadProgress(e) {
        n((0, s.setTrackLoaderProgress)("Reading track...", 100 / 6 + e * 100 / 6));
      },
      async onParseProgress(e) {
        n((0, s.setTrackLoaderProgress)("Parsing track...", 100 / 6 * 2 + e * 100 / 6));
        await (0, a.animationFrame)();
      }
    });
  }
  let d = await n(p(l, {
    localFile: false
  }));
  if (d) {
    n((0, c.setCloudInfo)(e.cloudInfo));
  }
  return d;
};
exports.loadTrackFromAutosave = e => async function (t) {
  t((0, s.setTrackLoaderProgress)("Loading from autosave...", true));
  return await t(p(e));
};
exports.loadTrackFromString = e => async function (t, n) {
  if ((0, u.getTrackIsDirty)(n())) {
    if (!confirm(h)) {
      return;
    }
  }
  t((0, s.setTrackLoaderProgress)("Loading...", 0));
  const r = JSON.parse(e);
  return await t(p(Promise.resolve(r), {
    localFile: false
  }));
};