Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.player = function (e = i, {
  type: t,
  payload: n
}) {
  let o;
  switch (t) {
    case r.SET_PLAYER_FPS:
      return Object.assign({}, e, {
        settings: Object.assign({}, e.settings, {
          fps: n
        })
      });
    case r.TOGGLE_INTERPOLATE:
      return Object.assign({}, e, {
        settings: Object.assign({}, e.settings, {
          interpolate: !e.settings.interpolate
        })
      });
    case r.SET_INTERPOLATE:
      return Object.assign({}, e, {
        settings: Object.assign({}, e.settings, {
          interpolate: n
        })
      });
    case r.NEW_TRACK:
      return Object.assign({}, i, {
        settings: e.settings
      });
    case r.ui.EDIT_COPY:
      return Object.assign({}, i, {
        maxIndex: e.maxIndex,
        settings: e.settings
      });
    case r.LOAD_TRACK:
      {
        let t = Math.ceil(n.duration || 0);
        return Object.assign({}, i, {
          maxIndex: t,
          settings: Object.assign({}, e.settings, {
            maxDuration: Math.max(e.settings.maxDuration, t)
          })
        });
      }
    case r.TOGGLE_SLOW_MOTION:
      return Object.assign({}, e, {
        slowMotion: !e.slowMotion
      });
    case r.SET_PLAYER_RUNNING:
      return Object.assign({}, e, {
        running: n
      });
    case r.SET_PLAYER_SCRUBBING:
      return Object.assign({}, e, {
        scrubbing: n
      });
    case r.SET_PLAYER_FAST_FORWARD:
      return Object.assign({}, e, {
        fastForward: n
      });
    case r.SET_PLAYER_REWIND:
      return Object.assign({}, e, {
        rewind: n
      });
    case r.SET_PLAYER_MAX_INDEX:
      return Object.assign({}, e, {
        maxIndex: Math.max(Math.min(n, e.settings.maxDuration), 1),
        index: Math.min(e.index, Math.max(n, 1)),
        flagIndex: Math.min(e.flagIndex, Math.max(n, 1))
      });
    case r.SET_PLAYER_INDEX:
      if (e.stopAtEnd && n > e.maxIndex) {
        return Object.assign({}, e, {
          running: false,
          index: e.maxIndex
        });
      } else if (n > e.settings.maxDuration) {
        return Object.assign({}, e, {
          running: false,
          index: e.settings.maxDuration
        });
      } else {
        return Object.assign({}, e, {
          index: n,
          maxIndex: e.stopAtEnd ? e.maxIndex : Math.max(e.maxIndex, n)
        });
      }
    case r.INC_PLAYER_INDEX:
      if ((o = Math.floor(e.index) + 1) > e.settings.maxDuration) {
        return Object.assign({}, e, {
          running: false,
          index: e.settings.maxDuration
        });
      } else {
        return Object.assign({}, e, {
          index: o,
          maxIndex: e.stopAtEnd ? e.maxIndex : Math.max(e.maxIndex, o)
        });
      }
    case r.DEC_PLAYER_INDEX:
      return Object.assign({}, e, {
        index: Math.max(0, Math.ceil(e.index) - 1)
      });
    case r.START_PLAYER:
      if (e.running) {
        return Object.assign({}, e, {
          index: e.flagIndex
        });
      } else if (e.stopAtEnd && e.index === e.maxIndex) {
        return Object.assign({}, e, {
          running: true,
          index: 0
        });
      } else {
        return Object.assign({}, e, {
          running: true
        });
      }
    case r.STOP_PLAYER:
      return Object.assign({}, e, {
        running: false,
        index: e.flagIndex
      });
    case r.SET_FLAG_INDEX:
      return Object.assign({}, e, {
        flagIndex: n
      });
    case r.SET_FLAG:
      if (e.running || e.flagIndex !== e.index) {
        return Object.assign({}, e, {
          flagIndex: e.index
        });
      } else {
        return Object.assign({}, e, {
          flagIndex: i.flagIndex
        });
      }
    case r.SET_PLAYER_STOP_AT_END:
      if (e.maxIndex === 0) {
        return e;
      } else {
        return Object.assign({}, e, {
          stopAtEnd: n
        });
      }
    case r.SET_PLAYER_SETTINGS:
      return Object.assign({}, e, {
        settings: Object.assign({}, e.settings, n)
      });
    default:
      return e;
  }
};
var r = function (e) {
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
}(require("./7.js"));
const i = {
  stopAtEnd: false,
  settings: {
    interpolate: true,
    fps: 40,
    baseRate: 1,
    slowMotionRate: 1 / 8,
    fastForwardRate: 4,
    maxDuration: 144000
  },
  running: false,
  slowMotion: false,
  fastForward: false,
  rewind: false,
  reverse: false,
  scrubbing: false,
  index: 0,
  flagIndex: 0,
  maxIndex: require("./208.js").TRIAL_DURATION * 40
};