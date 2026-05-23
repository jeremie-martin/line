Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./571.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
var a = require("./7.js");
var s = require("./8.js");
require("./110.js");
require("./26.js");
const l = {
  createPlayer: () => new o.default()
};
exports.default = ({
  createPlayer: e
} = l) => ({
  getState: t,
  dispatch: n
}) => {
  let r = null;
  if (window.AudioContext) {
    return i => function (o) {
      switch (o.type) {
        case a.LOAD_LOCAL_AUDIO:
          r ||= new class {
            constructor() {
              this.offset = 0;
              this.rate = 1;
              this.running = false;
              this.methods = {};
            }
            setInitialOffset(e) {
              this.offset = e;
            }
            setVolume(e) {
              this.methods.setVolume(e);
            }
            stop() {
              this.running = false;
              this.methods.stop();
            }
            play(e = 0, t = 1, n = false) {
              if (n || t === 1) {
                this.running = true;
                this.rate = t;
                this.methods.play(e + this.offset, t);
              } else if (this.running) {
                this.methods.stop();
              }
            }
            sync(e) {
              this.methods.sync(e + this.offset);
            }
            release() {
              this.methods.release();
            }
          }();
          r.setInitialOffset((0, s.getAudioOffset)(t()));
          r.setVolume((0, s.getAudioVolume)(t()));
          return i(o);
        case a.LOAD_AUDIO:
          r ||= e();
          r.setInitialOffset((0, s.getAudioOffset)(t()));
          r.setVolume((0, s.getAudioVolume)(t()));
          return r.loadAudio(o.payload.arraybuffer).then(() => {
            o.payload.enabled = true;
            i(o);
          }).catch(e => {
            n((0, a.audioLoadFail)(e));
          });
        case a.NEW_TRACK:
        case a.EDIT_COPY:
        case a.TOGGLE_AUDIO:
          if (r && (0, s.getAudioEnabled)(t())) {
            r.stop();
          }
          return i(o);
        case a.REMOVE_AUDIO:
          if (r) {
            r.release();
            r = null;
          }
          break;
        case a.LOAD_TRACK:
          if (r && (0, s.getAudioEnabled)(t())) {
            r.stop();
          }
          i(o);
          return;
        case a.SET_AUDIO_OFFSET:
          if (r) {
            r.setInitialOffset(o.payload);
          }
          i(o);
          break;
        case a.SET_AUDIO_VOLUME:
          if (r) {
            r.setVolume(o.payload);
          }
      }
      let l = i(o);
      let u = t();
      if (r && (0, s.getAudioEnabled)(u)) {
        let e = ((0, s.getPlayerRunning)(u) || u.player.fastForward || u.player.rewind) && !u.player.scrubbing;
        let t = (0, s.getCurrentPlayerRate)(u) * ((0, s.getPlayerReversed)(u) ? -1 : 1);
        let n = (0, s.getPlayerTime)(u);
        if (window.timeRemapper) {
          n = window.timeRemapper.physicsToReal(n);
        }
        if (r.running && !e) {
          r.stop();
        } else if (!e || r.running && r.rate === t) {
          if (r.running) {
            r.sync(n);
          }
        } else {
          r.play(n, t, false);
        }
      }
      return l;
    };
  } else {
    return e => t => e(t);
  }
};
module.exports = exports.default;