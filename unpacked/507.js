var t = require("./18.js");
var r = require("./508.js");
var i = require("./287.js");
var o = require("./509.js");
var a = require("./510.js");
var s = require("./200.js");
var l = s.isError;
var u = s.isObject;
var c = s.isPlainObject;
var d = s.isErrorEvent;
var f = s.isUndefined;
var p = s.isFunction;
var h = s.isString;
var m = s.isArray;
var y = s.isEmptyObject;
var g = s.each;
var v = s.objectMerge;
var b = s.truncate;
var _ = s.objectFrozen;
var w = s.hasKey;
var x = s.joinRegExp;
var E = s.urlencode;
var S = s.uuid4;
var T = s.htmlTreeAsString;
var k = s.isSameException;
var O = s.isSameStacktrace;
var P = s.parseUrl;
var C = s.fill;
var I = s.supportsFetch;
var M = s.supportsReferrerPolicy;
var L = s.serializeKeysForMessage;
var R = s.serializeException;
var A = s.sanitize;
var D = require("./511.js").wrapMethod;
var N = "source protocol user pass host port path".split(" ");
var j = /^(?:(\w+):)?\/\/(?:(\w+)(:\w+)?@)?([\w\.-]+)(?::(\d+))?(\/.*)/;
function F() {
  return +new Date();
}
var B = typeof window != "undefined" ? window : t !== undefined ? t : typeof self != "undefined" ? self : {};
var U = B.document;
var z = B.navigator;
function H(e, t) {
  if (p(t)) {
    return function (n) {
      return t(n, e);
    };
  } else {
    return t;
  }
}
function V() {
  this._hasJSON = typeof JSON == "object" && !!JSON.stringify;
  this._hasDocument = !f(U);
  this._hasNavigator = !f(z);
  this._lastCapturedException = null;
  this._lastData = null;
  this._lastEventId = null;
  this._globalServer = null;
  this._globalKey = null;
  this._globalProject = null;
  this._globalContext = {};
  this._globalOptions = {
    release: B.SENTRY_RELEASE && B.SENTRY_RELEASE.id,
    logger: "javascript",
    ignoreErrors: [],
    ignoreUrls: [],
    whitelistUrls: [],
    includePaths: [],
    headers: null,
    collectWindowErrors: true,
    captureUnhandledRejections: true,
    maxMessageLength: 0,
    maxUrlLength: 250,
    stackTraceLimit: 50,
    autoBreadcrumbs: true,
    instrument: true,
    sampleRate: 1,
    sanitizeKeys: []
  };
  this._fetchDefaults = {
    method: "POST",
    keepalive: true,
    referrerPolicy: M() ? "origin" : ""
  };
  this._ignoreOnError = 0;
  this._isRavenInstalled = false;
  this._originalErrorStackTraceLimit = Error.stackTraceLimit;
  this._originalConsole = B.console || {};
  this._originalConsoleMethods = {};
  this._plugins = [];
  this._startTime = F();
  this._wrappedBuiltIns = [];
  this._breadcrumbs = [];
  this._lastCapturedEvent = null;
  this._keypressTimeout;
  this._location = B.location;
  this._lastHref = this._location && this._location.href;
  this._resetBackoff();
  for (var e in this._originalConsole) {
    this._originalConsoleMethods[e] = this._originalConsole[e];
  }
}
V.prototype = {
  VERSION: "3.24.1",
  debug: false,
  TraceKit: r,
  config: function (e, t) {
    var n = this;
    if (n._globalServer) {
      this._logDebug("error", "Error: Raven has already been configured");
      return n;
    }
    if (!e) {
      return n;
    }
    var i = n._globalOptions;
    if (t) {
      g(t, function (e, t) {
        if (e === "tags" || e === "extra" || e === "user") {
          n._globalContext[e] = t;
        } else {
          i[e] = t;
        }
      });
    }
    n.setDSN(e);
    i.ignoreErrors.push(/^Script error\.?$/);
    i.ignoreErrors.push(/^Javascript error: Script error\.? on line 0$/);
    i.ignoreErrors = x(i.ignoreErrors);
    i.ignoreUrls = !!i.ignoreUrls.length && x(i.ignoreUrls);
    i.whitelistUrls = !!i.whitelistUrls.length && x(i.whitelistUrls);
    i.includePaths = x(i.includePaths);
    i.maxBreadcrumbs = Math.max(0, Math.min(i.maxBreadcrumbs || 100, 100));
    var o = {
      xhr: true,
      console: true,
      dom: true,
      location: true,
      sentry: true
    };
    var a = i.autoBreadcrumbs;
    if ({}.toString.call(a) === "[object Object]") {
      a = v(o, a);
    } else if (a !== false) {
      a = o;
    }
    i.autoBreadcrumbs = a;
    var s = {
      tryCatch: true
    };
    var l = i.instrument;
    if ({}.toString.call(l) === "[object Object]") {
      l = v(s, l);
    } else if (l !== false) {
      l = s;
    }
    i.instrument = l;
    r.collectWindowErrors = !!i.collectWindowErrors;
    return n;
  },
  install: function () {
    var e = this;
    if (e.isSetup() && !e._isRavenInstalled) {
      r.report.subscribe(function () {
        e._handleOnErrorStackInfo.apply(e, arguments);
      });
      if (e._globalOptions.captureUnhandledRejections) {
        e._attachPromiseRejectionHandler();
      }
      e._patchFunctionToString();
      if (e._globalOptions.instrument && e._globalOptions.instrument.tryCatch) {
        e._instrumentTryCatch();
      }
      if (e._globalOptions.autoBreadcrumbs) {
        e._instrumentBreadcrumbs();
      }
      e._drainPlugins();
      e._isRavenInstalled = true;
    }
    Error.stackTraceLimit = e._globalOptions.stackTraceLimit;
    return this;
  },
  setDSN: function (e) {
    var t = this._parseDSN(e);
    var n = t.path.lastIndexOf("/");
    var r = t.path.substr(1, n);
    this._dsn = e;
    this._globalKey = t.user;
    this._globalSecret = t.pass && t.pass.substr(1);
    this._globalProject = t.path.substr(n + 1);
    this._globalServer = this._getGlobalServer(t);
    this._globalEndpoint = this._globalServer + "/" + r + "api/" + this._globalProject + "/store/";
    this._resetBackoff();
  },
  context: function (e, t, n) {
    if (p(e)) {
      n = t || [];
      t = e;
      e = undefined;
    }
    return this.wrap(e, t).apply(this, n);
  },
  wrap: function (e, t, n) {
    var r = this;
    if (f(t) && !p(e)) {
      return e;
    }
    if (p(e)) {
      t = e;
      e = undefined;
    }
    if (!p(t)) {
      return t;
    }
    try {
      if (t.__raven__) {
        return t;
      }
      if (t.__raven_wrapper__) {
        return t.__raven_wrapper__;
      }
    } catch (e) {
      return t;
    }
    function i() {
      var i = [];
      var o = arguments.length;
      var a = !e || e && e.deep !== false;
      for (n && p(n) && n.apply(this, arguments); o--;) {
        i[o] = a ? r.wrap(e, arguments[o]) : arguments[o];
      }
      try {
        return t.apply(this, i);
      } catch (t) {
        r._ignoreNextOnError();
        r.captureException(t, e);
        throw t;
      }
    }
    for (var o in t) {
      if (w(t, o)) {
        i[o] = t[o];
      }
    }
    i.prototype = t.prototype;
    t.__raven_wrapper__ = i;
    i.__raven__ = true;
    i.__orig__ = t;
    return i;
  },
  uninstall: function () {
    r.report.uninstall();
    this._detachPromiseRejectionHandler();
    this._unpatchFunctionToString();
    this._restoreBuiltIns();
    this._restoreConsole();
    Error.stackTraceLimit = this._originalErrorStackTraceLimit;
    this._isRavenInstalled = false;
    return this;
  },
  _promiseRejectionHandler: function (e) {
    this._logDebug("debug", "Raven caught unhandled promise rejection:", e);
    this.captureException(e.reason, {
      extra: {
        unhandledPromiseRejection: true
      }
    });
  },
  _attachPromiseRejectionHandler: function () {
    this._promiseRejectionHandler = this._promiseRejectionHandler.bind(this);
    if (B.addEventListener) {
      B.addEventListener("unhandledrejection", this._promiseRejectionHandler);
    }
    return this;
  },
  _detachPromiseRejectionHandler: function () {
    if (B.removeEventListener) {
      B.removeEventListener("unhandledrejection", this._promiseRejectionHandler);
    }
    return this;
  },
  captureException: function (e, t) {
    t = v({
      trimHeadFrames: 0
    }, t || {});
    if (d(e) && e.error) {
      e = e.error;
    } else if (l(e)) {
      e = e;
    } else {
      if (!c(e)) {
        return this.captureMessage(e, v(t, {
          stacktrace: true,
          trimHeadFrames: t.trimHeadFrames + 1
        }));
      }
      t = this._getCaptureExceptionOptionsFromPlainObject(t, e);
      e = new Error(t.message);
    }
    this._lastCapturedException = e;
    try {
      var n = r.computeStackTrace(e);
      this._handleStackInfo(n, t);
    } catch (t) {
      if (e !== t) {
        throw t;
      }
    }
    return this;
  },
  _getCaptureExceptionOptionsFromPlainObject: function (e, t) {
    var n = Object.keys(t).sort();
    var r = v(e, {
      message: "Non-Error exception captured with keys: " + L(n),
      fingerprint: [o(n)],
      extra: e.extra || {}
    });
    r.extra.__serialized__ = R(t);
    return r;
  },
  captureMessage: function (e, t) {
    if (!this._globalOptions.ignoreErrors.test || !this._globalOptions.ignoreErrors.test(e)) {
      var n;
      var i = v({
        message: e += ""
      }, t = t || {});
      try {
        throw new Error(e);
      } catch (e) {
        n = e;
      }
      n.name = null;
      var o = r.computeStackTrace(n);
      var a = m(o.stack) && o.stack[1];
      var s = a && a.url || "";
      if ((!this._globalOptions.ignoreUrls.test || !this._globalOptions.ignoreUrls.test(s)) && (!this._globalOptions.whitelistUrls.test || this._globalOptions.whitelistUrls.test(s))) {
        if (this._globalOptions.stacktrace || t && t.stacktrace) {
          i.fingerprint = i.fingerprint == null ? e : i.fingerprint;
          (t = v({
            trimHeadFrames: 0
          }, t)).trimHeadFrames += 1;
          var l = this._prepareFrames(o, t);
          i.stacktrace = {
            frames: l.reverse()
          };
        }
        i.fingerprint &&= m(i.fingerprint) ? i.fingerprint : [i.fingerprint];
        this._send(i);
        return this;
      }
    }
  },
  captureBreadcrumb: function (e) {
    var t = v({
      timestamp: F() / 1000
    }, e);
    if (p(this._globalOptions.breadcrumbCallback)) {
      var n = this._globalOptions.breadcrumbCallback(t);
      if (u(n) && !y(n)) {
        t = n;
      } else if (n === false) {
        return this;
      }
    }
    this._breadcrumbs.push(t);
    if (this._breadcrumbs.length > this._globalOptions.maxBreadcrumbs) {
      this._breadcrumbs.shift();
    }
    return this;
  },
  addPlugin: function (e) {
    var t = [].slice.call(arguments, 1);
    this._plugins.push([e, t]);
    if (this._isRavenInstalled) {
      this._drainPlugins();
    }
    return this;
  },
  setUserContext: function (e) {
    this._globalContext.user = e;
    return this;
  },
  setExtraContext: function (e) {
    this._mergeContext("extra", e);
    return this;
  },
  setTagsContext: function (e) {
    this._mergeContext("tags", e);
    return this;
  },
  clearContext: function () {
    this._globalContext = {};
    return this;
  },
  getContext: function () {
    return JSON.parse(i(this._globalContext));
  },
  setEnvironment: function (e) {
    this._globalOptions.environment = e;
    return this;
  },
  setRelease: function (e) {
    this._globalOptions.release = e;
    return this;
  },
  setDataCallback: function (e) {
    var t = this._globalOptions.dataCallback;
    this._globalOptions.dataCallback = H(t, e);
    return this;
  },
  setBreadcrumbCallback: function (e) {
    var t = this._globalOptions.breadcrumbCallback;
    this._globalOptions.breadcrumbCallback = H(t, e);
    return this;
  },
  setShouldSendCallback: function (e) {
    var t = this._globalOptions.shouldSendCallback;
    this._globalOptions.shouldSendCallback = H(t, e);
    return this;
  },
  setTransport: function (e) {
    this._globalOptions.transport = e;
    return this;
  },
  lastException: function () {
    return this._lastCapturedException;
  },
  lastEventId: function () {
    return this._lastEventId;
  },
  isSetup: function () {
    return !!this._hasJSON && (!!this._globalServer || (this.ravenNotConfiguredError || (this.ravenNotConfiguredError = true, this._logDebug("error", "Error: Raven has not been configured.")), false));
  },
  afterLoad: function () {
    var e = B.RavenConfig;
    if (e) {
      this.config(e.dsn, e.config).install();
    }
  },
  showReportDialog: function (e) {
    if (U) {
      var t = (e = e || {}).eventId || this.lastEventId();
      if (!t) {
        throw new a("Missing eventId");
      }
      var n = e.dsn || this._dsn;
      if (!n) {
        throw new a("Missing DSN");
      }
      var r = encodeURIComponent;
      var i = "";
      i += "?eventId=" + r(t);
      i += "&dsn=" + r(n);
      var o = e.user || this._globalContext.user;
      if (o) {
        if (o.name) {
          i += "&name=" + r(o.name);
        }
        if (o.email) {
          i += "&email=" + r(o.email);
        }
      }
      var s = this._getGlobalServer(this._parseDSN(n));
      var l = U.createElement("script");
      l.async = true;
      l.src = s + "/api/embed/error-page/" + i;
      (U.head || U.body).appendChild(l);
    }
  },
  _ignoreNextOnError: function () {
    var e = this;
    this._ignoreOnError += 1;
    setTimeout(function () {
      e._ignoreOnError -= 1;
    });
  },
  _triggerEvent: function (e, t) {
    var n;
    var r;
    if (this._hasDocument) {
      t = t || {};
      e = "raven" + e.substr(0, 1).toUpperCase() + e.substr(1);
      if (U.createEvent) {
        (n = U.createEvent("HTMLEvents")).initEvent(e, true, true);
      } else {
        (n = U.createEventObject()).eventType = e;
      }
      for (r in t) {
        if (w(t, r)) {
          n[r] = t[r];
        }
      }
      if (U.createEvent) {
        U.dispatchEvent(n);
      } else {
        try {
          U.fireEvent("on" + n.eventType.toLowerCase(), n);
        } catch (e) {}
      }
    }
  },
  _breadcrumbEventHandler: function (e) {
    var t = this;
    return function (n) {
      t._keypressTimeout = null;
      if (t._lastCapturedEvent !== n) {
        var r;
        t._lastCapturedEvent = n;
        try {
          r = T(n.target);
        } catch (e) {
          r = "<unknown>";
        }
        t.captureBreadcrumb({
          category: "ui." + e,
          message: r
        });
      }
    };
  },
  _keypressEventHandler: function () {
    var e = this;
    return function (t) {
      var n;
      try {
        n = t.target;
      } catch (e) {
        return;
      }
      var r = n && n.tagName;
      if (r && (r === "INPUT" || r === "TEXTAREA" || n.isContentEditable)) {
        var i = e._keypressTimeout;
        if (!i) {
          e._breadcrumbEventHandler("input")(t);
        }
        clearTimeout(i);
        e._keypressTimeout = setTimeout(function () {
          e._keypressTimeout = null;
        }, 1000);
      }
    };
  },
  _captureUrlChange: function (e, t) {
    var n = P(this._location.href);
    var r = P(t);
    var i = P(e);
    this._lastHref = t;
    if (n.protocol === r.protocol && n.host === r.host) {
      t = r.relative;
    }
    if (n.protocol === i.protocol && n.host === i.host) {
      e = i.relative;
    }
    this.captureBreadcrumb({
      category: "navigation",
      data: {
        to: t,
        from: e
      }
    });
  },
  _patchFunctionToString: function () {
    var e = this;
    e._originalFunctionToString = Function.prototype.toString;
    Function.prototype.toString = function () {
      if (typeof this == "function" && this.__raven__) {
        return e._originalFunctionToString.apply(this.__orig__, arguments);
      } else {
        return e._originalFunctionToString.apply(this, arguments);
      }
    };
  },
  _unpatchFunctionToString: function () {
    if (this._originalFunctionToString) {
      Function.prototype.toString = this._originalFunctionToString;
    }
  },
  _instrumentTryCatch: function () {
    var e = this;
    var t = e._wrappedBuiltIns;
    function n(t) {
      return function (n, r) {
        for (var i = new Array(arguments.length), o = 0; o < i.length; ++o) {
          i[o] = arguments[o];
        }
        var a = i[0];
        if (p(a)) {
          i[0] = e.wrap(a);
        }
        if (t.apply) {
          return t.apply(this, i);
        } else {
          return t(i[0], i[1]);
        }
      };
    }
    var r = this._globalOptions.autoBreadcrumbs;
    function i(n) {
      var i = B[n] && B[n].prototype;
      if (i && i.hasOwnProperty && i.hasOwnProperty("addEventListener")) {
        C(i, "addEventListener", function (t) {
          return function (i, o, a, s) {
            try {
              if (o && o.handleEvent) {
                o.handleEvent = e.wrap(o.handleEvent);
              }
            } catch (e) {}
            var l;
            var u;
            var c;
            if (r && r.dom && (n === "EventTarget" || n === "Node")) {
              u = e._breadcrumbEventHandler("click");
              c = e._keypressEventHandler();
              l = function (e) {
                if (e) {
                  var t;
                  try {
                    t = e.type;
                  } catch (e) {
                    return;
                  }
                  if (t === "click") {
                    return u(e);
                  } else if (t === "keypress") {
                    return c(e);
                  } else {
                    return undefined;
                  }
                }
              };
            }
            return t.call(this, i, e.wrap(o, undefined, l), a, s);
          };
        }, t);
        C(i, "removeEventListener", function (e) {
          return function (t, n, r, i) {
            try {
              n = n && (n.__raven_wrapper__ ? n.__raven_wrapper__ : n);
            } catch (e) {}
            return e.call(this, t, n, r, i);
          };
        }, t);
      }
    }
    C(B, "setTimeout", n, t);
    C(B, "setInterval", n, t);
    if (B.requestAnimationFrame) {
      C(B, "requestAnimationFrame", function (t) {
        return function (n) {
          return t(e.wrap(n));
        };
      }, t);
    }
    for (var o = ["EventTarget", "Window", "Node", "ApplicationCache", "AudioTrackList", "ChannelMergerNode", "CryptoOperation", "EventSource", "FileReader", "HTMLUnknownElement", "IDBDatabase", "IDBRequest", "IDBTransaction", "KeyOperation", "MediaController", "MessagePort", "ModalWindow", "Notification", "SVGElementInstance", "Screen", "TextTrack", "TextTrackCue", "TextTrackList", "WebSocket", "WebSocketWorker", "Worker", "XMLHttpRequest", "XMLHttpRequestEventTarget", "XMLHttpRequestUpload"], a = 0; a < o.length; a++) {
      i(o[a]);
    }
  },
  _instrumentBreadcrumbs: function () {
    var e = this;
    var t = this._globalOptions.autoBreadcrumbs;
    var n = e._wrappedBuiltIns;
    function r(t, n) {
      if (t in n && p(n[t])) {
        C(n, t, function (t) {
          return e.wrap(t);
        });
      }
    }
    if (t.xhr && "XMLHttpRequest" in B) {
      var i = B.XMLHttpRequest && B.XMLHttpRequest.prototype;
      C(i, "open", function (t) {
        return function (n, r) {
          if (h(r) && r.indexOf(e._globalKey) === -1) {
            this.__raven_xhr = {
              method: n,
              url: r,
              status_code: null
            };
          }
          return t.apply(this, arguments);
        };
      }, n);
      C(i, "send", function (t) {
        return function () {
          var n = this;
          function i() {
            if (n.__raven_xhr && n.readyState === 4) {
              try {
                n.__raven_xhr.status_code = n.status;
              } catch (e) {}
              e.captureBreadcrumb({
                type: "http",
                category: "xhr",
                data: n.__raven_xhr
              });
            }
          }
          for (var o = ["onload", "onerror", "onprogress"], a = 0; a < o.length; a++) {
            r(o[a], n);
          }
          if ("onreadystatechange" in n && p(n.onreadystatechange)) {
            C(n, "onreadystatechange", function (t) {
              return e.wrap(t, undefined, i);
            });
          } else {
            n.onreadystatechange = i;
          }
          return t.apply(this, arguments);
        };
      }, n);
    }
    if (t.xhr && I()) {
      C(B, "fetch", function (t) {
        return function () {
          for (var n = new Array(arguments.length), r = 0; r < n.length; ++r) {
            n[r] = arguments[r];
          }
          var i;
          var o = n[0];
          var a = "GET";
          if (typeof o == "string") {
            i = o;
          } else if ("Request" in B && o instanceof B.Request) {
            i = o.url;
            if (o.method) {
              a = o.method;
            }
          } else {
            i = "" + o;
          }
          if (i.indexOf(e._globalKey) !== -1) {
            return t.apply(this, n);
          }
          if (n[1] && n[1].method) {
            a = n[1].method;
          }
          var s = {
            method: a,
            url: i,
            status_code: null
          };
          return t.apply(this, n).then(function (t) {
            s.status_code = t.status;
            e.captureBreadcrumb({
              type: "http",
              category: "fetch",
              data: s
            });
            return t;
          });
        };
      }, n);
    }
    if (t.dom && this._hasDocument) {
      if (U.addEventListener) {
        U.addEventListener("click", e._breadcrumbEventHandler("click"), false);
        U.addEventListener("keypress", e._keypressEventHandler(), false);
      } else if (U.attachEvent) {
        U.attachEvent("onclick", e._breadcrumbEventHandler("click"));
        U.attachEvent("onkeypress", e._keypressEventHandler());
      }
    }
    var o = B.chrome;
    var a = (!o || !o.app || !o.app.runtime) && B.history && history.pushState && history.replaceState;
    if (t.location && a) {
      var s = B.onpopstate;
      B.onpopstate = function () {
        var t = e._location.href;
        e._captureUrlChange(e._lastHref, t);
        if (s) {
          return s.apply(this, arguments);
        }
      };
      function l(t) {
        return function (_param, _param2, n) {
          if (n) {
            e._captureUrlChange(e._lastHref, n + "");
          }
          return t.apply(this, arguments);
        };
      }
      C(history, "pushState", l, n);
      C(history, "replaceState", l, n);
    }
    if (t.console && "console" in B && console.log) {
      function u(t, n) {
        e.captureBreadcrumb({
          message: t,
          level: n.level,
          category: "console"
        });
      }
      g(["debug", "info", "warn", "error", "log"], function (e, t) {
        D(console, t, u);
      });
    }
  },
  _restoreBuiltIns: function () {
    var e;
    while (this._wrappedBuiltIns.length) {
      var t = (e = this._wrappedBuiltIns.shift())[0];
      var n = e[1];
      var r = e[2];
      t[n] = r;
    }
  },
  _restoreConsole: function () {
    for (var e in this._originalConsoleMethods) {
      this._originalConsole[e] = this._originalConsoleMethods[e];
    }
  },
  _drainPlugins: function () {
    var e = this;
    g(this._plugins, function (t, n) {
      var r = n[0];
      var i = n[1];
      r.apply(e, [e].concat(i));
    });
  },
  _parseDSN: function (e) {
    var t = j.exec(e);
    var n = {};
    var r = 7;
    try {
      while (r--) {
        n[N[r]] = t[r] || "";
      }
    } catch (t) {
      throw new a("Invalid DSN: " + e);
    }
    if (n.pass && !this._globalOptions.allowSecretKey) {
      throw new a("Do not specify your secret key in the DSN. See: http://bit.ly/raven-secret-key");
    }
    return n;
  },
  _getGlobalServer: function (e) {
    var t = "//" + e.host + (e.port ? ":" + e.port : "");
    if (e.protocol) {
      t = e.protocol + ":" + t;
    }
    return t;
  },
  _handleOnErrorStackInfo: function () {
    if (!this._ignoreOnError) {
      this._handleStackInfo.apply(this, arguments);
    }
  },
  _handleStackInfo: function (e, t) {
    var n = this._prepareFrames(e, t);
    this._triggerEvent("handle", {
      stackInfo: e,
      options: t
    });
    this._processException(e.name, e.message, e.url, e.lineno, n, t);
  },
  _prepareFrames: function (e, t) {
    var n = this;
    var r = [];
    if (e.stack && e.stack.length && (g(e.stack, function (t, i) {
      var o = n._normalizeFrame(i, e.url);
      if (o) {
        r.push(o);
      }
    }), t && t.trimHeadFrames)) {
      for (var i = 0; i < t.trimHeadFrames && i < r.length; i++) {
        r[i].in_app = false;
      }
    }
    return r = r.slice(0, this._globalOptions.stackTraceLimit);
  },
  _normalizeFrame: function (e, t) {
    var n = {
      filename: e.url,
      lineno: e.line,
      colno: e.column,
      function: e.func || "?"
    };
    if (!e.url) {
      n.filename = t;
    }
    n.in_app = (!this._globalOptions.includePaths.test || !!this._globalOptions.includePaths.test(n.filename)) && !/(Raven|TraceKit)\./.test(n.function) && !/raven\.(min\.)?js$/.test(n.filename);
    return n;
  },
  _processException: function (e, t, n, r, i, o) {
    var a;
    var s = (e ? e + ": " : "") + (t || "");
    if ((!this._globalOptions.ignoreErrors.test || !this._globalOptions.ignoreErrors.test(t) && !this._globalOptions.ignoreErrors.test(s)) && (i && i.length ? (n = i[0].filename || n, i.reverse(), a = {
      frames: i
    }) : n && (a = {
      frames: [{
        filename: n,
        lineno: r,
        in_app: true
      }]
    }), (!this._globalOptions.ignoreUrls.test || !this._globalOptions.ignoreUrls.test(n)) && (!this._globalOptions.whitelistUrls.test || this._globalOptions.whitelistUrls.test(n)))) {
      var l = v({
        exception: {
          values: [{
            type: e,
            value: t,
            stacktrace: a
          }]
        },
        culprit: n
      }, o);
      this._send(l);
    }
  },
  _trimPacket: function (e) {
    var t = this._globalOptions.maxMessageLength;
    e.message &&= b(e.message, t);
    if (e.exception) {
      var n = e.exception.values[0];
      n.value = b(n.value, t);
    }
    var r = e.request;
    if (r) {
      r.url &&= b(r.url, this._globalOptions.maxUrlLength);
      r.Referer &&= b(r.Referer, this._globalOptions.maxUrlLength);
    }
    if (e.breadcrumbs && e.breadcrumbs.values) {
      this._trimBreadcrumbs(e.breadcrumbs);
    }
    return e;
  },
  _trimBreadcrumbs: function (e) {
    var t;
    var n;
    var r;
    var i = ["to", "from", "url"];
    for (var o = 0; o < e.values.length; ++o) {
      if ((n = e.values[o]).hasOwnProperty("data") && u(n.data) && !_(n.data)) {
        r = v({}, n.data);
        for (var a = 0; a < i.length; ++a) {
          t = i[a];
          if (r.hasOwnProperty(t) && r[t]) {
            r[t] = b(r[t], this._globalOptions.maxUrlLength);
          }
        }
        e.values[o].data = r;
      }
    }
  },
  _getHttpData: function () {
    if (this._hasNavigator || this._hasDocument) {
      var e = {};
      if (this._hasNavigator && z.userAgent) {
        e.headers = {
          "User-Agent": navigator.userAgent
        };
      }
      if (B.location && B.location.href) {
        e.url = B.location.href;
      }
      if (this._hasDocument && U.referrer) {
        e.headers ||= {};
        e.headers.Referer = U.referrer;
      }
      return e;
    }
  },
  _resetBackoff: function () {
    this._backoffDuration = 0;
    this._backoffStart = null;
  },
  _shouldBackoff: function () {
    return this._backoffDuration && F() - this._backoffStart < this._backoffDuration;
  },
  _isRepeatData: function (e) {
    var t = this._lastData;
    return !!t && e.message === t.message && e.culprit === t.culprit && (e.stacktrace || t.stacktrace ? O(e.stacktrace, t.stacktrace) : !e.exception && !t.exception || k(e.exception, t.exception));
  },
  _setBackoffState: function (e) {
    if (!this._shouldBackoff()) {
      var t = e.status;
      if (t === 400 || t === 401 || t === 429) {
        var n;
        try {
          n = I() ? e.headers.get("Retry-After") : e.getResponseHeader("Retry-After");
          n = parseInt(n, 10) * 1000;
        } catch (e) {}
        this._backoffDuration = n || this._backoffDuration * 2 || 1000;
        this._backoffStart = F();
      }
    }
  },
  _send: function (e) {
    var t = this._globalOptions;
    var n = {
      project: this._globalProject,
      logger: t.logger,
      platform: "javascript"
    };
    var r = this._getHttpData();
    if (r) {
      n.request = r;
    }
    if (e.trimHeadFrames) {
      delete e.trimHeadFrames;
    }
    (e = v(n, e)).tags = v(v({}, this._globalContext.tags), e.tags);
    e.extra = v(v({}, this._globalContext.extra), e.extra);
    e.extra["session:duration"] = F() - this._startTime;
    if (this._breadcrumbs && this._breadcrumbs.length > 0) {
      e.breadcrumbs = {
        values: [].slice.call(this._breadcrumbs, 0)
      };
    }
    if (this._globalContext.user) {
      e.user = this._globalContext.user;
    }
    if (t.environment) {
      e.environment = t.environment;
    }
    if (t.release) {
      e.release = t.release;
    }
    if (t.serverName) {
      e.server_name = t.serverName;
    }
    e = this._sanitizeData(e);
    Object.keys(e).forEach(function (t) {
      if (e[t] == null || e[t] === "" || y(e[t])) {
        delete e[t];
      }
    });
    if (p(t.dataCallback)) {
      e = t.dataCallback(e) || e;
    }
    if (e && !y(e)) {
      if (!p(t.shouldSendCallback) || !!t.shouldSendCallback(e)) {
        if (this._shouldBackoff()) {
          this._logDebug("warn", "Raven dropped error due to backoff: ", e);
        } else if (typeof t.sampleRate == "number") {
          if (Math.random() < t.sampleRate) {
            this._sendProcessedPayload(e);
          }
        } else {
          this._sendProcessedPayload(e);
        }
      }
    }
  },
  _sanitizeData: function (e) {
    return A(e, this._globalOptions.sanitizeKeys);
  },
  _getUuid: function () {
    return S();
  },
  _sendProcessedPayload: function (e, t) {
    var n = this;
    var r = this._globalOptions;
    if (this.isSetup()) {
      e = this._trimPacket(e);
      if (this._globalOptions.allowDuplicates || !this._isRepeatData(e)) {
        this._lastEventId = e.event_id ||= this._getUuid();
        this._lastData = e;
        this._logDebug("debug", "Raven about to send:", e);
        var i = {
          sentry_version: "7",
          sentry_client: "raven-js/" + this.VERSION,
          sentry_key: this._globalKey
        };
        if (this._globalSecret) {
          i.sentry_secret = this._globalSecret;
        }
        var o = e.exception && e.exception.values[0];
        if (this._globalOptions.autoBreadcrumbs && this._globalOptions.autoBreadcrumbs.sentry) {
          this.captureBreadcrumb({
            category: "sentry",
            message: o ? (o.type ? o.type + ": " : "") + o.value : e.message,
            event_id: e.event_id,
            level: e.level || "error"
          });
        }
        var a = this._globalEndpoint;
        (r.transport || this._makeRequest).call(this, {
          url: a,
          auth: i,
          data: e,
          options: r,
          onSuccess: function () {
            n._resetBackoff();
            n._triggerEvent("success", {
              data: e,
              src: a
            });
            if (t) {
              t();
            }
          },
          onError: function (r) {
            n._logDebug("error", "Raven transport failed to send: ", r);
            if (r.request) {
              n._setBackoffState(r.request);
            }
            n._triggerEvent("failure", {
              data: e,
              src: a
            });
            r = r || new Error("Raven send failed (no additional details provided)");
            if (t) {
              t(r);
            }
          }
        });
      } else {
        this._logDebug("warn", "Raven dropped repeat event: ", e);
      }
    }
  },
  _makeRequest: function (e) {
    var t = e.url + "?" + E(e.auth);
    var n = null;
    var r = {};
    if (e.options.headers) {
      n = this._evaluateHash(e.options.headers);
    }
    if (e.options.fetchParameters) {
      r = this._evaluateHash(e.options.fetchParameters);
    }
    if (I()) {
      r.body = i(e.data);
      var o = v({}, this._fetchDefaults);
      var a = v(o, r);
      if (n) {
        a.headers = n;
      }
      return B.fetch(t, a).then(function (t) {
        if (t.ok) {
          if (e.onSuccess) {
            e.onSuccess();
          }
        } else {
          var n = new Error("Sentry error code: " + t.status);
          n.request = t;
          if (e.onError) {
            e.onError(n);
          }
        }
      }).catch(function () {
        if (e.onError) {
          e.onError(new Error("Sentry error code: network unavailable"));
        }
      });
    }
    var s = B.XMLHttpRequest && new B.XMLHttpRequest();
    if (s) {
      if ("withCredentials" in s || typeof XDomainRequest != "undefined") {
        if ("withCredentials" in s) {
          s.onreadystatechange = function () {
            if (s.readyState === 4) {
              if (s.status === 200) {
                if (e.onSuccess) {
                  e.onSuccess();
                }
              } else if (e.onError) {
                var t = new Error("Sentry error code: " + s.status);
                t.request = s;
                e.onError(t);
              }
            }
          };
        } else {
          s = new XDomainRequest();
          t = t.replace(/^https?:/, "");
          if (e.onSuccess) {
            s.onload = e.onSuccess;
          }
          if (e.onError) {
            s.onerror = function () {
              var t = new Error("Sentry error code: XDomainRequest");
              t.request = s;
              e.onError(t);
            };
          }
        }
        s.open("POST", t);
        if (n) {
          g(n, function (e, t) {
            s.setRequestHeader(e, t);
          });
        }
        s.send(i(e.data));
      }
    }
  },
  _evaluateHash: function (e) {
    var t = {};
    for (var n in e) {
      if (e.hasOwnProperty(n)) {
        var r = e[n];
        t[n] = typeof r == "function" ? r() : r;
      }
    }
    return t;
  },
  _logDebug: function (e) {
    if (this._originalConsoleMethods[e] && this.debug) {
      Function.prototype.apply.call(this._originalConsoleMethods[e], this._originalConsole, [].slice.call(arguments, 1));
    }
  },
  _mergeContext: function (e, t) {
    if (f(t)) {
      delete this._globalContext[e];
    } else {
      this._globalContext[e] = v(this._globalContext[e] || {}, t);
    }
  }
};
V.prototype.setUser = V.prototype.setUserContext;
V.prototype.setReleaseContext = V.prototype.setRelease;
module.exports = V;