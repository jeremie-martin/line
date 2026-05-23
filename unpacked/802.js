Object.defineProperty(exports, "__esModule", {
  value: true
});
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
}(require("./80.js"));
var i = p(require("./803.js"));
var o = p(require("./1036.js"));
var a = p(require("./1037.js"));
var s = p(require("./1038.js"));
var l = p(require("./1041.js"));
var u = p(require("./1043.js"));
var c = p(require("./1045.js"));
var d = p(require("./1046.js"));
var f = require("./170.js");
function p(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = [[r.Main, (0, f.fadeWrap)(i.default)], [r.Entry, e => {
  let t = e.page;
  let n = function (e, t) {
    var n = {};
    for (var r in e) {
      if (!(t.indexOf(r) >= 0)) {
        if (Object.prototype.hasOwnProperty.call(e, r)) {
          n[r] = e[r];
        }
      }
    }
    return n;
  }(e, ["page"]);
  switch (t) {
    case r.Pages.Entry.Launch:
      return React.createElement(o.default, n);
    case r.Pages.Entry.Loading:
      return React.createElement(a.default, n);
  }
}], [r.TrackLoader, (0, f.fadeWrap)(s.default)], [r.TrackSaver, (0, f.fadeWrap)(l.default)], [r.VideoExporter, (0, f.fadeWrap)(u.default)], [r.ReleaseNotes, (0, f.fadeWrap)(c.default)], [r.About, (0, f.fadeWrap)(d.default)]];
module.exports = exports.default;