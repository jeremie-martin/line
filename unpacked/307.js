Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.loadTrack = async function (e, {
  onDownloadProgress: t,
  onReadProgress: n,
  onParseProgress: a,
  route: l
} = {}) {
  let u = e.cloudInfo;
  l = l || function () {
    if (u.trackId && u.masterKey) {
      return `${s}/tracks/${u.trackId}/latest-version?mk=${u.masterKey}`;
    }
    if (u.versionId) {
      if (u.derivativeKey) {
        return `${s}/versions/${u.versionId}?dk=${u.derivativeKey}`;
      } else {
        return `${s}/versions/${u.versionId}`;
      }
    }
    throw new Error("Invalid trackData.cloudInfo");
  }();
  return async function (e, {
    parse: t = (e, t) => {
      if (t) {
        t(0);
      }
      return JSON.parse(e);
    },
    onReadProgress: n,
    onParseProgress: r,
    connectionFailMessage: i = "Unable to connect to server. Check your connection"
  } = {}) {
    let a;
    let s;
    let l;
    try {
      a = await e;
    } catch (e) {
      e.message = i;
      throw e;
    }
    if (a.headers.get("content-type").match("text/html")) {
      if (!a.ok) {
        throw new Error(`${a.status}: ${a.statusText}`);
      }
      let e = await a.text();
      let t = e.match(/<title>(.*?)<\/title>/);
      throw new Error(`The server returned a webpage instead of data: "${t && t[1]}"`);
    }
    try {
      s = await (0, o.default)(a, n);
    } catch (e) {
      e.message = `Failed to read response: ${e.message}`;
      throw e;
    }
    try {
      l = await t(s, r);
    } catch (e) {
      e.message = `Failed to parse response: ${e.message}`;
      throw e;
    }
    if (l.error) {
      throw new Error(`API error code ${l.error.code}: ${l.error.description}`);
    }
    return l;
  }((0, r.default)(l, {
    credentials: "same-origin"
  }, {
    onDownloadProgress: t
  }), {
    parse: i.trackJsonParse,
    onReadProgress: n,
    onParseProgress: a
  });
};
var r = a(require("./595.js"));
var i = require("./211.js");
var o = a(i);
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
let s = "https://lr-webapp-v1.herokuapp.com/api/v1";