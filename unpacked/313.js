var r;
var i = i || function (e) {
  "use strict";

  if (e !== undefined && (typeof navigator == "undefined" || !/MSIE [1-9]\./.test(navigator.userAgent))) {
    function t() {
      return e.URL || e.webkitURL || e;
    }
    var n = e.document.createElementNS("http://www.w3.org/1999/xhtml", "a");
    var r = "download" in n;
    var i = /constructor/i.test(e.HTMLElement) || e.safari;
    var o = /CriOS\/[\d]+/.test(navigator.userAgent);
    function a(t) {
      (e.setImmediate || e.setTimeout)(function () {
        throw t;
      }, 0);
    }
    function s(e) {
      setTimeout(function () {
        if (typeof e == "string") {
          t().revokeObjectURL(e);
        } else {
          e.remove();
        }
      }, 40000);
    }
    function l(e) {
      if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(e.type)) {
        return new Blob([String.fromCharCode(65279), e], {
          type: e.type
        });
      } else {
        return e;
      }
    }
    function u(u, c, d) {
      if (!d) {
        u = l(u);
      }
      var f;
      var p = this;
      var h = u.type === "application/octet-stream";
      function m() {
        (function (e, t, n) {
          for (var r = (t = [].concat(t)).length; r--;) {
            var i = e["on" + t[r]];
            if (typeof i == "function") {
              try {
                i.call(e, n || e);
              } catch (e) {
                a(e);
              }
            }
          }
        })(p, "writestart progress write writeend".split(" "));
      }
      p.readyState = p.INIT;
      if (r) {
        f = t().createObjectURL(u);
        setTimeout(function () {
          var e;
          var t;
          n.href = f;
          n.download = c;
          e = n;
          t = new MouseEvent("click");
          e.dispatchEvent(t);
          m();
          s(f);
          p.readyState = p.DONE;
        });
        return;
      }
      (function () {
        if ((o || h && i) && e.FileReader) {
          var n = new FileReader();
          n.onloadend = function () {
            var t = o ? n.result : n.result.replace(/^data:[^;]*;/, "data:attachment/file;");
            if (!e.open(t, "_blank")) {
              e.location.href = t;
            }
            t = undefined;
            p.readyState = p.DONE;
            m();
          };
          n.readAsDataURL(u);
          p.readyState = p.INIT;
          return;
        }
        f ||= t().createObjectURL(u);
        if (h) {
          e.location.href = f;
        } else if (!e.open(f, "_blank")) {
          e.location.href = f;
        }
        p.readyState = p.DONE;
        m();
        s(f);
      })();
    }
    var c = u.prototype;
    if (typeof navigator != "undefined" && navigator.msSaveOrOpenBlob) {
      return function (e, t, n) {
        t = t || e.name || "download";
        if (!n) {
          e = l(e);
        }
        return navigator.msSaveOrOpenBlob(e, t);
      };
    } else {
      c.abort = function () {};
      c.readyState = c.INIT = 0;
      c.WRITING = 1;
      c.DONE = 2;
      c.error = c.onwritestart = c.onprogress = c.onwrite = c.onabort = c.onerror = c.onwriteend = null;
      return function (e, t, n) {
        return new u(e, t || e.name || "download", n);
      };
    }
  }
}(typeof self != "undefined" && self || typeof window != "undefined" && window || this.content);
if (module.exports) {
  module.exports.saveAs = i;
} else if (require("./625.js") !== null && require("./626.js") !== null) {
  if ((r = function () {
    return i;
  }.call(exports, require, exports, module)) !== undefined) {
    module.exports = r;
  }
}