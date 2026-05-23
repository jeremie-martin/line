Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, t, {
  onUploadProgress: n,
  onDownloadProgress: o
} = {}) {
  return new Promise(function (a, s) {
    var l = new Request(e, t);
    var u = new XMLHttpRequest();
    u.onload = function () {
      var e = {
        status: u.status,
        statusText: u.statusText,
        headers: i(u.getAllResponseHeaders())
      };
      e.url = "responseURL" in u ? u.responseURL : e.headers.get("X-Request-URL");
      var t = "response" in u ? u.response : u.responseText;
      let n = new Response(t, e);
      n.bodySize = t.size;
      a(n);
    };
    u.onerror = function () {
      s(new TypeError("Network request failed"));
    };
    u.ontimeout = function () {
      s(new TypeError("Network request failed"));
    };
    u.open(l.method, l.url, true);
    if (l.credentials === "include") {
      u.withCredentials = true;
    } else if (l.credentials === "omit") {
      u.withCredentials = false;
    }
    if ("responseType" in u && r.blob) {
      u.responseType = "blob";
    }
    l.headers.forEach(function (e, t) {
      u.setRequestHeader(t, e);
    });
    if (o) {
      let e;
      let t = false;
      u.onreadystatechange = n => {
        switch (u.readyState) {
          case XMLHttpRequest.HEADERS_RECEIVED:
            let n = i(u.getAllResponseHeaders());
            let r = parseInt(n.get("Content-Length"), 10);
            t = n.get("content-encoding") === "gzip";
            e = r * (t ? 7 : 1);
        }
      };
      u.onprogress = n => o(n.loaded / e, t);
    }
    if (u.upload && n) {
      u.upload.onprogress = e => e.lengthComputable && n(e.loaded / e.total);
      u.upload.onerror = u.onerror;
    }
    let c = t.body;
    u.send(c === undefined ? null : c);
  });
};
var r = {
  blob: "FileReader" in window && "Blob" in window && function () {
    try {
      new Blob();
      return true;
    } catch (e) {
      return false;
    }
  }()
};
function i(e = "") {
  var t = new Headers();
  e.replace(/\r?\n[\t ]+/g, " ").split(/\r?\n/).forEach(function (e) {
    var n = e.split(":");
    var r = n.shift().trim();
    if (r) {
      var i = n.join(":").trim();
      t.append(r, i);
    }
  });
  return t;
}
module.exports = exports.default;