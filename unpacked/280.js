Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getAudioEnabled = e => e.audio.enabled;
exports.getAudioOffset = e => e.audio.offset;
exports.getAudioVolume = e => e.audio.volume;
exports.isAudioFileLoading = e => e.audioFileLoader.loadingFile;
exports.getAudioProps = e => e.audio;
exports.getAudioFileLoading = e => e.audioFileLoader;
exports.getLocalAudioProps = e => {
  var t = e.audio;
  const n = t.name;
  const r = t.path;
  const i = t.offset;
  if (r) {
    return {
      name: n,
      path: r,
      offset: i
    };
  } else {
    return null;
  }
};