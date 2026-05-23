(function (e) {
  "use strict";

  if (!e.fetch) {
    var t = {
      searchParams: "URLSearchParams" in e,
      iterable: "Symbol" in e && "iterator" in Symbol,
      blob: "FileReader" in e && "Blob" in e && function () {
        try {
          new Blob();
          return true;
        } catch (e) {
          return false;
        }
      }(),
      formData: "FormData" in e,
      arrayBuffer: "ArrayBuffer" in e
    };
    if (t.arrayBuffer) {
      var n = ["[object Int8Array]", "[object Uint8Array]", "[object Uint8ClampedArray]", "[object Int16Array]", "[object Uint16Array]", "[object Int32Array]", "[object Uint32Array]", "[object Float32Array]", "[object Float64Array]"];
      function r(e) {
        return e && DataView.prototype.isPrototypeOf(e);
      }
      var i = ArrayBuffer.isView || function (e) {
        return e && n.indexOf(Object.prototype.toString.call(e)) > -1;
      };
    }
    c.prototype.append = function (e, t) {
      e = s(e);
      t = l(t);
      var n = this.map[e];
      this.map[e] = n ? n + "," + t : t;
    };
    c.prototype.delete = function (e) {
      delete this.map[s(e)];
    };
    c.prototype.get = function (e) {
      e = s(e);
      if (this.has(e)) {
        return this.map[e];
      } else {
        return null;
      }
    };
    c.prototype.has = function (e) {
      return this.map.hasOwnProperty(s(e));
    };
    c.prototype.set = function (e, t) {
      this.map[s(e)] = l(t);
    };
    c.prototype.forEach = function (e, t) {
      for (var n in this.map) {
        if (this.map.hasOwnProperty(n)) {
          e.call(t, this.map[n], n, this);
        }
      }
    };
    c.prototype.keys = function () {
      var e = [];
      this.forEach(function (t, n) {
        e.push(n);
      });
      return u(e);
    };
    c.prototype.values = function () {
      var e = [];
      this.forEach(function (t) {
        e.push(t);
      });
      return u(e);
    };
    c.prototype.entries = function () {
      var e = [];
      this.forEach(function (t, n) {
        e.push([n, t]);
      });
      return u(e);
    };
    if (t.iterable) {
      c.prototype[Symbol.iterator] = c.prototype.entries;
    }
    var o = ["DELETE", "GET", "HEAD", "OPTIONS", "POST", "PUT"];
    y.prototype.clone = function () {
      return new y(this, {
        body: this._bodyInit
      });
    };
    m.call(y.prototype);
    m.call(v.prototype);
    v.prototype.clone = function () {
      return new v(this._bodyInit, {
        status: this.status,
        statusText: this.statusText,
        headers: new c(this.headers),
        url: this.url
      });
    };
    v.error = function () {
      var e = new v(null, {
        status: 0,
        statusText: ""
      });
      e.type = "error";
      return e;
    };
    var a = [301, 302, 303, 307, 308];
    v.redirect = function (e, t) {
      if (a.indexOf(t) === -1) {
        throw new RangeError("Invalid status code");
      }
      return new v(null, {
        status: t,
        headers: {
          location: e
        }
      });
    };
    e.Headers = c;
    e.Request = y;
    e.Response = v;
    e.fetch = function (e, n) {
      return new Promise(function (r, i) {
        var o = new y(e, n);
        var a = new XMLHttpRequest();
        a.onload = function () {
          var e;
          var t;
          var n = {
            status: a.status,
            statusText: a.statusText,
            headers: (e = a.getAllResponseHeaders() || "", t = new c(), e.replace(/\r?\n[\t ]+/g, " ").split(/\r?\n/).forEach(function (e) {
              var n = e.split(":");
              var r = n.shift().trim();
              if (r) {
                var i = n.join(":").trim();
                t.append(r, i);
              }
            }), t)
          };
          n.url = "responseURL" in a ? a.responseURL : n.headers.get("X-Request-URL");
          var i = "response" in a ? a.response : a.responseText;
          r(new v(i, n));
        };
        a.onerror = function () {
          i(new TypeError("Network request failed"));
        };
        a.ontimeout = function () {
          i(new TypeError("Network request failed"));
        };
        a.open(o.method, o.url, true);
        if (o.credentials === "include") {
          a.withCredentials = true;
        } else if (o.credentials === "omit") {
          a.withCredentials = false;
        }
        if ("responseType" in a && t.blob) {
          a.responseType = "blob";
        }
        o.headers.forEach(function (e, t) {
          a.setRequestHeader(t, e);
        });
        a.send(o._bodyInit === undefined ? null : o._bodyInit);
      });
    };
    e.fetch.polyfill = true;
  }
  function s(e) {
    if (typeof e != "string") {
      e = String(e);
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(e)) {
      throw new TypeError("Invalid character in header field name");
    }
    return e.toLowerCase();
  }
  function l(e) {
    if (typeof e != "string") {
      e = String(e);
    }
    return e;
  }
  function u(e) {
    var n = {
      next: function () {
        var t = e.shift();
        return {
          done: t === undefined,
          value: t
        };
      }
    };
    if (t.iterable) {
      n[Symbol.iterator] = function () {
        return n;
      };
    }
    return n;
  }
  function c(e) {
    this.map = {};
    if (e instanceof c) {
      e.forEach(function (e, t) {
        this.append(t, e);
      }, this);
    } else if (Array.isArray(e)) {
      e.forEach(function (e) {
        this.append(e[0], e[1]);
      }, this);
    } else if (e) {
      Object.getOwnPropertyNames(e).forEach(function (t) {
        this.append(t, e[t]);
      }, this);
    }
  }
  function d(e) {
    if (e.bodyUsed) {
      return Promise.reject(new TypeError("Already read"));
    }
    e.bodyUsed = true;
  }
  function f(e) {
    return new Promise(function (t, n) {
      e.onload = function () {
        t(e.result);
      };
      e.onerror = function () {
        n(e.error);
      };
    });
  }
  function p(e) {
    var t = new FileReader();
    var n = f(t);
    t.readAsArrayBuffer(e);
    return n;
  }
  function h(e) {
    if (e.slice) {
      return e.slice(0);
    }
    var t = new Uint8Array(e.byteLength);
    t.set(new Uint8Array(e));
    return t.buffer;
  }
  function m() {
    this.bodyUsed = false;
    this._initBody = function (e) {
      this._bodyInit = e;
      if (e) {
        if (typeof e == "string") {
          this._bodyText = e;
        } else if (t.blob && Blob.prototype.isPrototypeOf(e)) {
          this._bodyBlob = e;
        } else if (t.formData && FormData.prototype.isPrototypeOf(e)) {
          this._bodyFormData = e;
        } else if (t.searchParams && URLSearchParams.prototype.isPrototypeOf(e)) {
          this._bodyText = e.toString();
        } else if (t.arrayBuffer && t.blob && r(e)) {
          this._bodyArrayBuffer = h(e.buffer);
          this._bodyInit = new Blob([this._bodyArrayBuffer]);
        } else {
          if (!t.arrayBuffer || !ArrayBuffer.prototype.isPrototypeOf(e) && !i(e)) {
            throw new Error("unsupported BodyInit type");
          }
          this._bodyArrayBuffer = h(e);
        }
      } else {
        this._bodyText = "";
      }
      if (!this.headers.get("content-type")) {
        if (typeof e == "string") {
          this.headers.set("content-type", "text/plain;charset=UTF-8");
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set("content-type", this._bodyBlob.type);
        } else if (t.searchParams && URLSearchParams.prototype.isPrototypeOf(e)) {
          this.headers.set("content-type", "application/x-www-form-urlencoded;charset=UTF-8");
        }
      }
    };
    if (t.blob) {
      this.blob = function () {
        var e = d(this);
        if (e) {
          return e;
        }
        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob);
        }
        if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]));
        }
        if (this._bodyFormData) {
          throw new Error("could not read FormData body as blob");
        }
        return Promise.resolve(new Blob([this._bodyText]));
      };
      this.arrayBuffer = function () {
        if (this._bodyArrayBuffer) {
          return d(this) || Promise.resolve(this._bodyArrayBuffer);
        } else {
          return this.blob().then(p);
        }
      };
    }
    this.text = function () {
      var e;
      var t;
      var n;
      var r = d(this);
      if (r) {
        return r;
      }
      if (this._bodyBlob) {
        e = this._bodyBlob;
        t = new FileReader();
        n = f(t);
        t.readAsText(e);
        return n;
      }
      if (this._bodyArrayBuffer) {
        return Promise.resolve(function (e) {
          for (var t = new Uint8Array(e), n = new Array(t.length), r = 0; r < t.length; r++) {
            n[r] = String.fromCharCode(t[r]);
          }
          return n.join("");
        }(this._bodyArrayBuffer));
      }
      if (this._bodyFormData) {
        throw new Error("could not read FormData body as text");
      }
      return Promise.resolve(this._bodyText);
    };
    if (t.formData) {
      this.formData = function () {
        return this.text().then(g);
      };
    }
    this.json = function () {
      return this.text().then(JSON.parse);
    };
    return this;
  }
  function y(e, t) {
    var n;
    var r;
    var i = (t = t || {}).body;
    if (e instanceof y) {
      if (e.bodyUsed) {
        throw new TypeError("Already read");
      }
      this.url = e.url;
      this.credentials = e.credentials;
      if (!t.headers) {
        this.headers = new c(e.headers);
      }
      this.method = e.method;
      this.mode = e.mode;
      if (!i && e._bodyInit != null) {
        i = e._bodyInit;
        e.bodyUsed = true;
      }
    } else {
      this.url = String(e);
    }
    this.credentials = t.credentials || this.credentials || "omit";
    if (!!t.headers || !this.headers) {
      this.headers = new c(t.headers);
    }
    this.method = (n = t.method || this.method || "GET", r = n.toUpperCase(), o.indexOf(r) > -1 ? r : n);
    this.mode = t.mode || this.mode || null;
    this.referrer = null;
    if ((this.method === "GET" || this.method === "HEAD") && i) {
      throw new TypeError("Body not allowed for GET or HEAD requests");
    }
    this._initBody(i);
  }
  function g(e) {
    var t = new FormData();
    e.trim().split("&").forEach(function (e) {
      if (e) {
        var n = e.split("=");
        var r = n.shift().replace(/\+/g, " ");
        var i = n.join("=").replace(/\+/g, " ");
        t.append(decodeURIComponent(r), decodeURIComponent(i));
      }
    });
    return t;
  }
  function v(e, t) {
    t ||= {};
    this.type = "default";
    this.status = t.status === undefined ? 200 : t.status;
    this.ok = this.status >= 200 && this.status < 300;
    this.statusText = "statusText" in t ? t.statusText : "OK";
    this.headers = new c(t.headers);
    this.url = t.url || "";
    this._initBody(e);
  }
})(typeof self != "undefined" ? self : this);