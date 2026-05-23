Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./572.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
const a = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
exports.default = class {
  constructor() {
    let e = new AudioContext();
    if (e.state === "suspended") {
      window.unlockAudioContext = new Promise((t, n) => {
        const r = () => {
          e.resume();
          window.removeEventListener("mousedown", r);
          window.removeEventListener("touchend", r);
          t();
        };
        window.addEventListener("mousedown", r);
        window.addEventListener("touchend", r);
      });
    } else if (a) {
      window.unlockAudioContext = new Promise((t, n) => {
        (0, o.default)(window, e, t);
      });
    }
    this.audioContext = e;
    this.buffer = null;
    this.reversedBuffer = null;
    this.source = null;
    this.activeSource = null;
    this.playbackRate = 1;
    this.initialOffset = 0;
    this.gain = this.audioContext.createGain();
    this.gain.connect(this.audioContext.destination);
    this.running = false;
    this.rate = 1;
  }
  async loadAudio(e) {
    let t = await this.audioContext.decodeAudioData(e);
    this.initNewBuffer(t);
  }
  setInitialOffset(e) {
    this.initialOffset = e;
  }
  setVolume(e) {
    this.gain.gain.setValueAtTime(e, 0);
  }
  initSource(e = false) {
    this.source = this.audioContext.createBufferSource();
    this.source.buffer = e ? this.reversedBuffer : this.buffer;
    this.source.connect(this.gain);
  }
  initNewBuffer(e) {
    this.stop();
    this.buffer = e;
    this.reversedBuffer = function (e, t) {
      let n = [];
      let r = t.numberOfChannels;
      for (let o = 0; o < r; o++) {
        n[o] = new Float32Array(t.getChannelData(o));
        n[o].reverse();
      }
      let i = e.createBuffer(t.numberOfChannels, t.length, t.sampleRate);
      for (let o = 0; o < r; o++) {
        i.getChannelData(o).set(n[o]);
      }
      return i;
    }(this.audioContext, e);
    this.initSource();
  }
  stop() {
    if (this.activeSource) {
      this.activeSource.stop(0);
      this.activeSource = null;
      this.running = false;
    }
  }
  play(e = 0, t = 1) {
    if (this.activeSource) {
      this.stop();
    }
    let n = t < 0;
    this.playOffset = e;
    this.playRate = t;
    this.playTime = this.audioContext.currentTime;
    e += this.initialOffset;
    if ((e = n ? this.source.buffer.duration - e : e) > this.buffer.duration) {
      return;
    }
    let r = this.playTime + Math.max(0, -e);
    e = Math.max(0, e);
    this.initSource(n);
    this.source.playbackRate.value = Math.abs(t);
    this.source.start(r, e);
    this.activeSource = this.source;
    this.running = true;
    this.rate = t;
  }
  sync(e) {
    if (!this.activeSource) {
      return;
    }
    let t = (e - this.playOffset) / this.playRate;
    let n = this.audioContext.currentTime - this.playTime;
    if (Math.abs(t - n) > 0.025) {
      this.play(e, this.playRate);
    }
  }
  release() {
    this.stop();
  }
};
module.exports = exports.default;