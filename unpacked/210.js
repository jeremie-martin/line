Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.removeSavedTrack = exports.getLocalTrack = exports.putLocalTrack = exports.listSavedTracks = exports.open = undefined;
var r;
var i = require("./305.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
require("./26.js");
let a = new o.default("track_list");
a.version(1).stores({
  tracks: "masterKey, &trackId, &versionId, saveTime, title, creator, description"
});
a.version(2).stores({
  savedTracks: "cloudInfo.trackId, cloudInfo.saveTime"
}).upgrade(e => e.tracks.toArray().then(t => e.savedTracks.bulkPut(t.map(({
  title: e,
  creator: t,
  description: n,
  trackId: r,
  versionId: i,
  masterKey: o,
  derivativeKey: a,
  versionTitle: s,
  saveTime: l,
  derivedFrom: u
}) => ({
  details: {
    title: e,
    creator: t,
    description: n
  },
  cloudInfo: Object.assign({
    trackId: r,
    versionTitle: s,
    versionId: i,
    masterKey: o,
    derivativeKey: a,
    saveTime: l
  }, u && {
    derivedFrom: u
  })
})))));
a.version(3).stores({
  localTracks: ""
});
exports.open = () => a.open();
const s = () => a.table("savedTracks");
const l = () => a.table("localTracks");
const u = {
  listSavedTracks: () => s().orderBy("cloudInfo.saveTime").reverse().filter(e => !e.removed).toArray(),
  putLocalTrack: async function (e, t) {
    const n = s();
    const r = l();
    return a.transaction("rw", n, r, async function () {
      await r.put(t, e.cloudInfo.trackId);
      await n.put(e);
    });
  },
  getLocalTrack: e => l().get(e.cloudInfo.trackId),
  removeSavedTrack: e => s().update(e.cloudInfo.trackId, {
    removed: true
  })
};
exports.listSavedTracks = u.listSavedTracks;
exports.putLocalTrack = u.putLocalTrack;
exports.getLocalTrack = u.getLocalTrack;
exports.removeSavedTrack = u.removeSavedTrack;