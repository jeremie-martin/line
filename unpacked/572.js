module.exports = function (e, t, n) {
  function r(i) {
    var o = t.createBuffer(1, 1, 22050);
    var a = t.createBufferSource();
    a.buffer = o;
    a.connect(t.destination);
    a.start(t.currentTime);
    setTimeout(function () {
      e.removeEventListener("mousedown", r, false);
      e.removeEventListener("touchend", r, false);
      n(a.playbackState === a.PLAYING_STATE || a.playbackState === a.FINISHED_STATE);
    }, 1);
  }
  e.addEventListener("mousedown", r, false);
  e.addEventListener("touchend", r, false);
};