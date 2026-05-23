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
var i = c(require("./82.js"));
var o = c(require("./622.js"));
var a = require("./34.js");
var s = require("./623.js");
var l = c(s);
var u = c(require("./213.js"));
function c(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const d = e => e;
const f = {
  ignoreErrors: ["top.GLOBALS", "originalCreateNotification", "canvas.contentDocument", "MyApp_RemoveAllHighlights", "http://tt.epicplay.com", "Can't find variable: ZiteReader", "jigsaw is not defined", "ComboSearch is not defined", "http://loading.retry.widdit.com/", "atomicFindClose", "fb_xd_fragment", "bmi_SafeAddOnload", "EBCallBackMessageReceived", "conduitPage"],
  ignoreUrls: [/graph\.facebook\.com/i, /connect\.facebook\.net\/en_US\/all\.js/i, /eatdifferent\.com\.woopra-ns\.com/i, /static\.woopra\.com\/js\/woopra\.js/i, /extensions\//i, /^chrome:\/\//i, /127\.0\.0\.1:4001\/isrunning/i, /webappstoolbarba\.texthelp\.com\//i, /metrics\.itunes\.apple\.com\.edgesuite\.net\//i]
};
exports.default = e => {
  if (l.default === s.DEVELOPMENT) {
    return;
  }
  const t = function () {
    let e = {};
    return {
      middleware: t => n => r => r.meta && r.meta.ignorable ? n(r) : (e = {
        mostRecentAction: r,
        mostRecentState: t.getState()
      }, n(r)),
      handleData: t => t.extra.state ? t : Object.assign({}, t, {
        extra: Object.assign({}, t.extra, e)
      })
    };
  }();
  const n = Object.assign({}, f, {
    shouldSendCallback: function (e) {
      let t = new Map();
      return n => {
        let r = t.get(n.message);
        if (!r) {
          r = {
            throttled: false,
            delay: e
          };
          t.set(n.message, r);
        }
        return !r.throttled && (r.throttled = true, setTimeout(() => {
          r.throttled = false;
          r.delay *= 2;
        }, r.delay), true);
      };
    }(2000),
    dataCallback: e => function (e) {
      let t = e.extra.state ? "state" : "mostRecentState";
      let n = e.extra[t];
      return Object.assign({}, e, {
        extra: Object.assign({}, e.extra, {
          [t]: (0, o.default)(n)
        })
      });
    }(t.handleData(e)),
    release: u.default,
    environment: l.default
  });
  e.push(t.middleware);
  e.push(function (e, t = {}, n = {}) {
    if (!i.default.isSetup()) {
      if (!e) {
        console.error("[redux-raven-middleware] Sentry DSN required.");
        return e => e => t => {
          e(t);
        };
      }
      i.default.config(e, t).install();
    }
    return e => t => o => {
      if (o.meta && o.meta.ignorable) {
        return t(o);
      }
      var s = n.actionTransformer;
      const l = s === undefined ? d : s;
      var u = n.stateTransformer;
      const c = u === undefined ? d : u;
      let f = (0, a.getActionName)(o);
      let p = f;
      let h = i.default._breadcrumbs[i.default._breadcrumbs.length - 1];
      if (h && h.category === "redux") {
        if (h.message === f) {
          i.default._breadcrumbs.pop();
          p = `${f} x2`;
        } else {
          let e = /(.+) x(\d+)/.exec(h.message);
          if (e) {
            var m = r(e, 3);
            let t = m[1];
            let n = m[2];
            if (t === f) {
              i.default._breadcrumbs.pop();
              p = `${f} x${parseInt(n) + 1}`;
            }
          }
        }
      }
      i.default.captureBreadcrumb({
        category: "redux",
        message: p
      });
      try {
        return t(o);
      } catch (t) {
        i.default.captureException(t, {
          extra: {
            action: l(o),
            state: c(e.getState())
          }
        });
      }
    };
  }("https://1343b6cdb9d34a0f94273506175edb1b@sentry.io/100731", n));
};
module.exports = exports.default;