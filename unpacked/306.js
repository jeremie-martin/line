Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.initAutosaveTrackObject = exports.initAutosaveDirty = exports.clearAutosaveTrackObject = exports.setAutosaveTrackObject = exports.setAutosaveDirty = exports.getAutosaveTrackObject = exports.getAutosaveDirty = undefined;
var r;
var i = require("./111.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
const a = {
  props: {
    riders: [{
      startPosition: {
        x: 0,
        y: 0
      },
      startVelocity: {
        x: 0.4,
        y: 0
      },
      remountable: 1
    }],
    version: "6.2"
  },
  details: {
    title: "",
    creator: "",
    description: ""
  },
  info: {
    duration: 40
  },
  cloudInfo: null,
  localFile: false
};
const s = exports.getAutosaveDirty = () => JSON.parse(o.default.getItem("AUTOSAVE_DIRTY"));
const l = exports.getAutosaveTrackObject = () => JSON.parse(o.default.getItem("AUTOSAVE_TRACK_OBJECT"));
const u = exports.setAutosaveDirty = e => o.default.setItem("AUTOSAVE_DIRTY", JSON.stringify(e));
const c = exports.setAutosaveTrackObject = e => o.default.setItem("AUTOSAVE_TRACK_OBJECT", JSON.stringify(e));
exports.clearAutosaveTrackObject = () => c(a);
if (s() == null) {
  let e = o.default.getItem("AUTOSAVE_TRACK_DATA");
  if (e != null) {
    try {
      var d = JSON.parse(e);
      let t = d.startPosition;
      let n = d.version;
      let r = d.label;
      let i = d.creator;
      let o = d.description;
      let a = d.derivedFrom;
      let s = d.cloudInfo;
      var f = d.localFile;
      let l = f !== undefined && f;
      var p = d.dirty;
      u(p !== undefined && p);
      c({
        props: {
          startPosition: t,
          version: n
        },
        details: {
          title: r || "",
          creator: i || "",
          description: o || ""
        },
        cloudInfo: s && Object.assign({}, s, {
          derivedFrom: a
        }),
        info: {
          duration: 40
        },
        localFile: l
      });
    } catch (e) {
      console.error("something went wrong while migrating autosave track data:", e);
    }
  }
}
exports.initAutosaveDirty = s();
exports.initAutosaveTrackObject = l();