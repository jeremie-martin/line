Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.trackData = function (e = i, {
  type: t,
  payload: n
}) {
  switch (t) {
    case r.NEW_TRACK:
    case r.LOAD_TRACK:
      let i = n.startPosition;
      let a = n.riders;
      let s = n.version;
      let l = n.label;
      let u = n.creator;
      let c = n.description;
      let d = n.saveTime;
      let f = n.derivedFrom;
      let p = n.cloudInfo;
      let h = n.localFile;
      let m = n.script;
      var o = n.viewOnly;
      let y = o !== undefined && o;
      return {
        startPosition: i,
        riders: a,
        version: s,
        label: l,
        creator: u,
        description: c,
        saveTime: d,
        derivedFrom: f,
        cloudInfo: p,
        localFile: h,
        script: m,
        viewOnly: y
      };
    case r.ui.EDIT_COPY:
      return Object.assign({}, e, {
        label: "Copy of " + e.label,
        creator: "",
        description: ""
      });
    case r.trackData.SET_CLOUD_INFO:
      return Object.assign({}, e, {
        cloudInfo: n
      });
    case r.trackData.SET_TRACK_DETAILS:
      return Object.assign({}, e, {
        label: n.title,
        creator: n.creator,
        description: n.description,
        saveTime: n.cloudInfo ? n.cloudInfo.saveTime : null,
        derivedFrom: n.derivedFrom,
        cloudInfo: n.cloudInfo
      });
    case r.trackData.SET_LOCAL_FILE:
      return Object.assign({}, e, {
        localFile: n
      });
    case r.trackData.SET_TRACK_SCRIPT:
      return Object.assign({}, e, {
        script: n
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
  startPosition: {
    x: 0,
    y: 0
  },
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
  version: "6.2",
  label: "",
  creator: "",
  description: "",
  saveTime: null,
  derivedFrom: null,
  cloudInfo: null,
  localFile: false,
  viewOnly: false,
  script: ""
};