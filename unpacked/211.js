var e = require("./308.js").Buffer;
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
exports.readTrackFile = async function (t, {
  getTrackIndex: n,
  onReadProgress: r,
  onBeforeParse: o
} = {}) {
  let a = new FileReader();
  let s = new Promise((e, t) => {
    a.onload = t => e(t.target.result);
    a.onerror = t;
  });
  a.onprogress = e => {
    if (e.lengthComputable && r) {
      r(e.loaded / e.total * 100);
    }
  };
  let l = t.name.split(".").pop();
  switch (l) {
    case "json":
      {
        a.readAsText(t);
        let e = await s;
        if (o) {
          await o();
        }
        return (0, i.jsonReader)(e);
      }
    case "trk":
      {
        a.readAsArrayBuffer(t);
        let n = await s;
        if (o) {
          await o();
        }
        let r = (0, i.trkReader)(e.from(new Uint8Array(n)));
        r.label = t.name;
        return r;
      }
    case "sol":
      {
        a.readAsArrayBuffer(t);
        let r = await s;
        if (o) {
          await o();
        }
        let l = (0, i.solReader)(e.from(new Uint8Array(r)));
        if (l.length === 0) {
          throw new Error("There are no tracks in this file");
        }
        if (l.length === 1) {
          return l[0];
        }
        let u = await n(l);
        let c = l[u];
        if (u == null) {
          throw new Error("No track was selected");
        }
        if (!c) {
          throw new Error("Invalid track index");
        }
        return c;
      }
    default:
      throw new Error(`Unknown track file type: ${l}`);
  }
};
exports.trackJsonParse = async function (e, t, n = 1000000) {
  let i = /([^]*?"lines":\s*\[)([^]*?)(][^]*)/.exec(e);
  if (!i) {
    return JSON.parse(e);
  }
  var o = r(i, 4);
  let a = o[1];
  let s = o[2];
  let l = o[3];
  let u = JSON.parse(a + l);
  for (let r = 0, c = s.length; r < c;) {
    if (t) {
      await t(r / c);
    }
    let e = s.indexOf("{", r);
    if (e === -1) {
      break;
    }
    let i = e + n;
    if (i < s.length) {
      let e = s.lastIndexOf("}", i);
      if (e !== -1) {
        i = e;
      }
    }
    i++;
    let o = JSON.parse(`[${s.slice(e, i)}]`);
    u.lines.push(...o);
    r = i;
  }
  return u;
};
exports.trackJsonStringify = async function (e, t, n = 50000) {
  let r = e.lines;
  let i = function (e, t) {
    var n = {};
    for (var r in e) {
      if (!(t.indexOf(r) >= 0)) {
        if (Object.prototype.hasOwnProperty.call(e, r)) {
          n[r] = e[r];
        }
      }
    }
    return n;
  }(e, ["lines"]);
  let o = JSON.stringify(i);
  o = o.slice(0, -1);
  o += ",\"lines\":[";
  for (let a = 0; a < r.length; a += n) {
    if (t) {
      await t(a / r.length);
    }
    if (a > 0) {
      o += ",";
    }
    let e = r.slice(a, a + n);
    o += JSON.stringify(e).slice(1, -1);
  }
  return o += "]}";
};
exports.gzipByChunks = async function (e, t, n = 1000000) {
  let r = new o.Deflate({
    gzip: true
  });
  for (let i = 0; i < e.length; i += n) {
    if (t) {
      await t(i / e.length);
    }
    let o = e.slice(i, i + n);
    r.push(o, false);
  }
  r.push("", true);
  return r.result;
};
var i = require("./599.js");
var o = require("./610.js");
exports.default = async function (e, t) {
  let n;
  if (t) {
    t(0);
    let e = performance.now();
    n = n => {
      let r = performance.now();
      if (r - e > 200) {
        e = r;
        t(n);
      }
    };
  }
  if ("body" in Response.prototype && "TextDecoder" in window) {
    let t = e.body.getReader();
    let r = new TextDecoder();
    let i = e.bodySize;
    let o = 0;
    return async function e(a = "") {
      let s = await t.read();
      a += r.decode(s.value || new Uint8Array(), {
        stream: !s.done
      });
      o += s.value != null ? s.value.length : 0;
      if (n) {
        n(o / i);
      }
      if (s.done) {
        return a;
      } else {
        return e(a);
      }
    }();
  }
  {
    let t = new FileReader();
    let r = new Promise((e, n) => {
      t.onload = t => e(t.target.result);
      t.onerror = n;
    });
    if (n) {
      t.onprogress = e => e.lengthComputable && n(e.loaded / e.total);
    }
    t.readAsText(await e.blob());
    return r;
  }
};