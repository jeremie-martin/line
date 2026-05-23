var e = require("./18.js");
Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = function () {
  function e(e, t) {
    for (var n = 0; n < t.length; n++) {
      var r = t[n];
      r.enumerable = r.enumerable || false;
      r.configurable = true;
      if ("value" in r) {
        r.writable = true;
      }
      Object.defineProperty(e, r.key, r);
    }
  }
  return function (t, n, r) {
    if (n) {
      e(t.prototype, n);
    }
    if (r) {
      e(t, r);
    }
    return t;
  };
}();
function i(e, t, n) {
  for (var r = true; r;) {
    var i = e;
    var o = t;
    var a = n;
    u = l = undefined;
    r = false;
    if (i === null) {
      i = Function.prototype;
    }
    var s = Object.getOwnPropertyDescriptor(i, o);
    if (s !== undefined) {
      if ("value" in s) {
        return s.value;
      }
      var l = s.get;
      if (l === undefined) {
        return;
      }
      return l.call(a);
    }
    var u = Object.getPrototypeOf(i);
    if (u === null) {
      return;
    }
    e = u;
    t = o;
    n = a;
    r = true;
  }
}
function o(e, t) {
  if (!(e instanceof t)) {
    throw new TypeError("Cannot call a class as a function");
  }
}
function a(e, t) {
  if (typeof t != "function" && t !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof t);
  }
  e.prototype = Object.create(t && t.prototype, {
    constructor: {
      value: e,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (t) {
    e.__proto__ = t;
  }
}
exports.install = function (e) {
  (function () {
    if (!s.prototype.hasOwnProperty("createStereoPanner")) {
      var e = require("./467.js");
      s.prototype.createStereoPanner = function () {
        return new e(this);
      };
    }
  })();
  (function () {
    var e = new l(1, 1, 44100);
    var t = false;
    try {
      var n = new Uint32Array([1179011410, 48, 1163280727, 544501094, 16, 131073, 44100, 176400, 1048580, 1635017060, 8, 0, 0, 0, 0]).buffer;
      t = !!e.decodeAudioData(n, d);
    } catch (e) {}
    if (!t) {
      var r = s.prototype.decodeAudioData;
      s.prototype.decodeAudioData = function (e, t, n) {
        var i = this;
        var o = new Promise(function (t, n) {
          return r.call(i, e, t, n);
        });
        o.then(t, n);
        return o;
      };
      s.prototype.decodeAudioData.original = r;
    }
  })();
  (function () {
    var e = new l(1, 1, 44100);
    var t = false;
    try {
      t = !!e.startRendering();
    } catch (e) {}
    if (!t) {
      var n = l.prototype.startRendering;
      l.prototype.startRendering = function () {
        var e = this;
        return new Promise(function (t) {
          var r = e.oncomplete;
          e.oncomplete = function (n) {
            t(n.renderedBuffer);
            if (typeof r == "function") {
              r.call(e, n);
            }
          };
          n.call(e);
        });
      };
      l.prototype.startRendering.original = n;
    }
  })();
  if (e !== 0) {
    (function () {
      if (s.prototype.hasOwnProperty("close")) {
        return;
      }
      f();
    })();
    (function () {
      if (s.prototype.hasOwnProperty("resume")) {
        return;
      }
      f();
    })();
    (function () {
      if (s.prototype.hasOwnProperty("suspend")) {
        return;
      }
      f();
    })();
  }
};
var s = e.AudioContext;
var l = e.OfflineAudioContext;
var u = e.AudioNode;
var c = e.EventTarget || e.Object.constructor;
function d() {}
function f() {
  if (e.AudioContext === s) {
    var t;
    var n;
    n = c;
    (t = p).prototype = Object.create(n.prototype, {
      constructor: {
        value: t,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    Object.defineProperties(p.prototype, {
      destination: {
        get: function () {
          return this._.destination;
        }
      },
      sampleRate: {
        get: function () {
          return this._.sampleRate;
        }
      },
      currentTime: {
        get: function () {
          return this._.currentTime || this._.audioContext.currentTime;
        }
      },
      listener: {
        get: function () {
          return this._.audioContext.listener;
        }
      },
      state: {
        get: function () {
          return this._.state;
        }
      },
      onstatechange: {
        set: function (e) {
          if (typeof e == "function") {
            this._.onstatechange = e;
          }
        },
        get: function () {
          return this._.onstatechange;
        }
      }
    });
    var d = function (e) {
      function t() {
        o(this, t);
        i(Object.getPrototypeOf(t.prototype), "constructor", this).call(this, new s());
        this._.state = "running";
        if (!s.prototype.hasOwnProperty("suspend")) {
          this._.destination = this._.audioContext.createGain();
          this._.destination.connect(this._.audioContext.destination);
          this._.destination.connect = function () {
            this._.audioContext.destination.connect.apply(this._.audioContext.destination, arguments);
          };
          this._.destination.disconnect = function () {
            this._.audioContext.destination.connect.apply(this._.audioContext.destination, arguments);
          };
          this._.destination.channelCountMode = "explicit";
        }
      }
      a(t, p);
      return t;
    }();
    d.prototype.suspend = function () {
      var t = this;
      if (this._.state === "closed") {
        return Promise.reject(new Error("cannot suspend a closed AudioContext"));
      }
      function n() {
        this._.state = "suspended";
        this._.currentTime = this._.audioContext.currentTime;
      }
      var r = undefined;
      if (typeof this._.audioContext == "function") {
        (r = this._.audioContext.suspend()).then(function () {
          n.call(t);
        });
      } else {
        u.prototype.disconnect.call(this._.destination);
        (r = Promise.resolve()).then(function () {
          n.call(t);
          var r = new e.Event("statechange");
          if (typeof t._.onstatechange == "function") {
            t._.onstatechange(r);
          }
          t.dispatchEvent(r);
        });
      }
      return r;
    };
    d.prototype.resume = function () {
      var t = this;
      if (this._.state === "closed") {
        return Promise.reject(new Error("cannot resume a closed AudioContext"));
      }
      function n() {
        this._.state = "running";
        this._.currentTime = 0;
      }
      var r = undefined;
      if (typeof this._.audioContext.resume == "function") {
        (r = this._.audioContext.resume()).then(function () {
          n.call(t);
        });
      } else {
        u.prototype.connect.call(this._.destination, this._.audioContext.destination);
        (r = Promise.resolve()).then(function () {
          n.call(t);
          var r = new e.Event("statechange");
          if (typeof t._.onstatechange == "function") {
            t._.onstatechange(r);
          }
          t.dispatchEvent(r);
        });
      }
      return r;
    };
    d.prototype.close = function () {
      var t = this;
      if (this._.state === "closed") {
        return Promise.reject(new Error("Cannot close a context that is being closed or has already been closed."));
      }
      function n() {
        this._.state = "closed";
        this._.currentTime = Infinity;
        this._.sampleRate = 0;
      }
      var r = undefined;
      if (typeof this._.audioContext.close == "function") {
        (r = this._.audioContext.close()).then(function () {
          n.call(t);
        });
      } else {
        if (typeof this._.audioContext.suspend == "function") {
          this._.audioContext.suspend();
        } else {
          u.prototype.disconnect.call(this._.destination);
        }
        (r = Promise.resolve()).then(function () {
          n.call(t);
          var r = new e.Event("statechange");
          if (typeof t._.onstatechange == "function") {
            t._.onstatechange(r);
          }
          t.dispatchEvent(r);
        });
      }
      return r;
    };
    ["addEventListener", "removeEventListener", "dispatchEvent", "createBuffer"].forEach(function (e) {
      d.prototype[e] = function () {
        return this._.audioContext[e].apply(this._.audioContext, arguments);
      };
    });
    ["decodeAudioData", "createBufferSource", "createMediaElementSource", "createMediaStreamSource", "createMediaStreamDestination", "createAudioWorker", "createScriptProcessor", "createAnalyser", "createGain", "createDelay", "createBiquadFilter", "createWaveShaper", "createPanner", "createStereoPanner", "createConvolver", "createChannelSplitter", "createChannelMerger", "createDynamicsCompressor", "createOscillator", "createPeriodicWave"].forEach(function (e) {
      d.prototype[e] = function () {
        if (this._.state === "closed") {
          throw new Error("Failed to execute '" + e + "' on 'AudioContext': AudioContext has been closed");
        }
        return this._.audioContext[e].apply(this._.audioContext, arguments);
      };
    });
    var f = function (e) {
      function t(e, n, r) {
        o(this, t);
        i(Object.getPrototypeOf(t.prototype), "constructor", this).call(this, new l(e, n, r));
        this._.state = "suspended";
      }
      a(t, p);
      r(t, [{
        key: "oncomplete",
        set: function (e) {
          this._.audioContext.oncomplete = e;
        },
        get: function () {
          return this._.audioContext.oncomplete;
        }
      }]);
      return t;
    }();
    ["addEventListener", "removeEventListener", "dispatchEvent", "createBuffer", "decodeAudioData", "createBufferSource", "createMediaElementSource", "createMediaStreamSource", "createMediaStreamDestination", "createAudioWorker", "createScriptProcessor", "createAnalyser", "createGain", "createDelay", "createBiquadFilter", "createWaveShaper", "createPanner", "createStereoPanner", "createConvolver", "createChannelSplitter", "createChannelMerger", "createDynamicsCompressor", "createOscillator", "createPeriodicWave"].forEach(function (e) {
      f.prototype[e] = function () {
        return this._.audioContext[e].apply(this._.audioContext, arguments);
      };
    });
    f.prototype.startRendering = function () {
      var t = this;
      if (this._.state !== "suspended") {
        return Promise.reject(new Error("cannot call startRendering more than once"));
      }
      this._.state = "running";
      var n = this._.audioContext.startRendering();
      n.then(function () {
        t._.state = "closed";
        var n = new e.Event("statechange");
        if (typeof t._.onstatechange == "function") {
          t._.onstatechange(n);
        }
        t.dispatchEvent(n);
      });
      return n;
    };
    f.prototype.suspend = function () {
      if (typeof this._.audioContext.suspend == "function") {
        return this._.audioContext.suspend();
      } else {
        return Promise.reject(new Error("cannot suspend an OfflineAudioContext"));
      }
    };
    f.prototype.resume = function () {
      if (typeof this._.audioContext.resume == "function") {
        return this._.audioContext.resume();
      } else {
        return Promise.reject(new Error("cannot resume an OfflineAudioContext"));
      }
    };
    f.prototype.close = function () {
      if (typeof this._.audioContext.close == "function") {
        return this._.audioContext.close();
      } else {
        return Promise.reject(new Error("cannot close an OfflineAudioContext"));
      }
    };
    e.AudioContext = d;
    e.OfflineAudioContext = f;
  }
  function p(e) {
    this._ = {};
    this._.audioContext = e;
    this._.destination = e.destination;
    this._.state = "";
    this._.currentTime = 0;
    this._.sampleRate = e.sampleRate;
    this._.onstatechange = null;
  }
}