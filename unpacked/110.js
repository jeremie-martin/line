Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getAudioFromURL = exports.loadAudioFile = exports.loadLocalAudio = undefined;
var r = require("./7.js");
var i = require("./26.js");
exports.loadLocalAudio = (e, t, n) => function (o) {
  o((0, r.loadAudioPending)());
  window.loadAudioFileCb = i => {
    if (i) {
      o((0, r.audioLoadFail)({
        message: i
      }));
      if (n) {
        n(i);
      }
    } else {
      o((0, r.loadLocalAudioAction)(e, t));
      if (n) {
        n();
      }
    }
    window.loadAudioFileCb = null;
  };
  (0, i.dispatchToDevice)("loadAudioFile", e);
};
exports.loadAudioFile = e => function (t) {
  t((0, r.loadAudioPending)());
  return new Promise((n, i) => {
    let o = new FileReader();
    o.onload = i => {
      let o = i.target.result;
      t((0, r.loadAudio)(e.name, o));
      n();
    };
    o.onerror = i;
    o.readAsArrayBuffer(e);
  });
};
exports.getAudioFromURL = e => async function (t) {
  t((0, r.loadAudioPending)());
  try {
    let n = await window.fetch(e);
    let i = await n.arrayBuffer();
    t((0, r.loadAudio)(e, i));
  } catch (e) {
    t((0, r.audioLoadFail)(e));
  }
};