Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getTrackObjectForSaving = exports.getTrackObjectForAutosave = exports.getTrackInfo = exports.getTrackDetailsWithCloudInfo = exports.getTrackShareLinks = exports.getTrackCloudInfo = exports.getTrackDetails = exports.getTrackProps = exports.getTrackScript = exports.getTrackIsLocalFile = undefined;
var r;
var i = require("./297.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
var a = require("./17.js");
var s = require("./140.js");
var l = require("./141.js");
var u = require("./280.js");
const c = exports.getTrackIsLocalFile = e => e.trackData.localFile;
const d = exports.getTrackScript = e => e.trackData.script;
const f = exports.getTrackProps = (0, a.createStructuredSelector)({
  riders: l.getCommittedRiders,
  version: l.getSimulatorVersion,
  audio: u.getLocalAudioProps,
  layers: l.getTrackLayers,
  script: d
});
const p = exports.getTrackDetails = (0, a.createStructuredSelector)({
  title: e => e.trackData.label,
  creator: e => e.trackData.creator,
  description: e => e.trackData.description
});
const h = exports.getTrackCloudInfo = (0, a.createSelector)(e => e.trackData.cloudInfo, e => e.trackData.derivedFrom, e => e.trackData.saveTime, (e, t, n) => t ? Object.assign({
  saveTime: n
}, e, {
  derivedFrom: t
}) : e ? Object.assign({
  saveTime: n
}, e) : n ? {
  saveTime: n
} : undefined);
exports.getTrackShareLinks = (0, a.createSelector)(e => p(e).title, h, (e, t) => {
  if (!t) {
    return {};
  }
  e = (e = t.versionTitle || e) ? (0, o.default)(e) : "";
  let n = window.location.origin;
  return {
    edit: `${n}/edit/${t.versionId}/${e}?k=${t.derivativeKey}`,
    view: `${n}/view/${t.versionId}/${e}`
  };
});
exports.getTrackDetailsWithCloudInfo = (0, a.createStructuredSelector)({
  details: p,
  cloudInfo: h
});
const m = exports.getTrackInfo = (0, a.createStructuredSelector)({
  duration: e => (0, s.getPlayerMaxIndex)(e)
});
exports.getTrackObjectForAutosave = (0, a.createStructuredSelector)({
  props: f,
  details: p,
  info: m,
  cloudInfo: h,
  localFile: c
});
exports.getTrackObjectForSaving = (e, t) => ({
  label: t.title,
  creator: t.creator,
  description: t.description,
  duration: (0, s.getPlayerMaxIndex)(e),
  version: (0, l.getSimulatorVersion)(e),
  audio: (0, u.getLocalAudioProps)(e),
  startPosition: (0, l.getSimulatorStartPos)(e),
  riders: (0, l.getCommittedRiders)(e),
  lines: (0, l.getSimulatorLines)(e).toJS(),
  layers: (0, l.getTrackLayers)(e).toJS(),
  script: d(e)
});