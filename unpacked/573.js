Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = function () {
  return function (e, t) {
    if (Array.isArray(e)) {
      return e;
    }
    if (Symbol.iterator in Object(e)) {
      return function (e, t) {
        var n = [];
        var r = true;
        var i = false;
        var o = undefined;
        try {
          for (var a, s = e[Symbol.iterator](); !(r = (a = s.next()).done) && (n.push(a.value), !t || n.length !== t); r = true);
        } catch (e) {
          i = true;
          o = e;
        } finally {
          try {
            if (!r && s.return) {
              s.return();
            }
          } finally {
            if (i) {
              throw o;
            }
          }
        }
        return n;
      }(e, t);
    }
    throw new TypeError("Invalid attempt to destructure non-iterable instance");
  };
}();
var i = v(require("./574.js"));
var o = v(require("./25.js"));
var a = g(require("./304.js"));
var s = require("./306.js");
var l = require("./7.js");
var u = g(require("./198.js"));
var c = require("./139.js");
var d = require("./149.js");
var f = require("./8.js");
require("./109.js");
var p = require("./29.js");
var h = require("./34.js");
var m = require("./112.js");
var y = require("./110.js");
function g(e) {
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
function v(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
let b = new Set();
const _ = {
  immy: {
    getBuffer: function (e) {
      e.__getBuffer();
      return e.buffer;
    },
    getDiff: function (e, t) {
      b.clear();
      let n = [];
      let r = [];
      e.compareTo(t).forEachPrimitive(e => {
        if (e instanceof o.default.ListPatches.Add) {
          n.push(e.value);
          b.add(e.value.id);
        } else {
          r.push(e.value);
        }
      });
      r = r.filter(e => !b.has(e.id));
      return [n, r];
    }
  }
};
exports.default = ({
  immy: e
} = _) => ({
  dispatch: t,
  getState: n
}) => {
  let o = s.initAutosaveTrackObject;
  let g = (0, f.getSimulatorLines)(n());
  let v = false;
  let b = true;
  const _ = 1000;
  let w = [];
  let x = false;
  let E = 0;
  let S = 0;
  async function T(e, n = []) {
    w.push([e, n]);
    S += e.length + n.length;
    if (x) {
      return;
    }
    x = true;
    let o = async function () {
      while (w.length > 0 && b) {
        var e = w.shift();
        var t = r(e, 2);
        let n = t[0];
        let o = t[1];
        if (o.length > 0) {
          for (let e of (0, i.default)(o, _)) {
            if (!b) {
              break;
            }
            await a.removeLines(e);
            E += e.length;
          }
        }
        if (n.length > 0) {
          for (let e of (0, i.default)(n, _)) {
            if (!b) {
              break;
            }
            await a.addLines(e);
            E += e.length;
          }
        }
      }
      return false;
    }();
    Promise.race([o, (0, h.delay)(1000, true)]).then(async function (e) {
      if (e) {
        t((0, p.showNotification)("Autosaving...", false));
        await o;
        t((0, p.hideNotification)("Autosaving..."));
      }
    });
    await o;
    x = false;
    E = 0;
    S = 0;
  }
  return i => function (p) {
    if ((0, f.getInViewer)(n()) || !(0, m.getAutosaveEnabled)(n()) || !a.isOpen()) {
      return i(p);
    }
    let h = (0, f.getTrackIsDirty)(n());
    let _ = (0, f.getTrackObjectForAutosave)(n());
    let w = i(p);
    switch (p.type) {
      case u.LOAD_AUTOSAVE:
        v = true;
        let e = a.getLines().then(e => ({
          startPosition: o.props.startPosition,
          riders: o.props.riders,
          version: o.props.version,
          layers: o.props.layers,
          label: o.details.title,
          creator: o.details.creator,
          description: o.details.description,
          duration: o.info.duration,
          derivedFrom: o.cloudInfo && o.cloudInfo.derivedFrom,
          cloudInfo: o.cloudInfo,
          localFile: o.localFile,
          script: o.props.script,
          dirty: true,
          lines: e
        }));
        return t((0, d.loadTrackFromAutosave)(e)).then(() => {
          const e = o.props.audio;
          if (e) {
            t((0, y.loadLocalAudio)(e.path, e.name));
            t((0, l.setAudioOffset)(e.offset));
          }
          g = (0, f.getSimulatorLines)(n());
          v = false;
        });
      case u.CLEAR_AUTOSAVE:
      case l.NEW_TRACK:
      case l.LOAD_TRACK:
      case c.EDIT_COPY:
        if (!v) {
          b = false;
        }
    }
    if ((0, f.getSimulatorTrack)(n()) !== (0, f.getSimulatorCommittedTrack)(n())) {
      return w;
    }
    if (!v) {
      let t = (0, f.getTrackIsDirty)(n());
      let i = (0, f.getTrackObjectForAutosave)(n());
      if (b) {
        if (h !== t) {
          (0, s.setAutosaveDirty)(t);
          h = t;
        }
        if (i !== _) {
          (0, s.setAutosaveTrackObject)(i);
        }
      }
      let o = (0, f.getSimulatorLines)(n());
      if (o !== g && t) {
        if (b) {
          var x = e.getDiff(g, o);
          var E = r(x, 2);
          T(E[0], E[1]);
        } else {
          b = true;
          (0, s.setAutosaveDirty)(true);
          (0, s.setAutosaveTrackObject)(i);
          a.clearLines();
          T(o.toJS());
        }
        g = o;
      }
    }
    return w;
  };
};
module.exports = exports.default;