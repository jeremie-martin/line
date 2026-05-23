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
}(require("./27.js"));
var i = f(require("./1057.js"));
var o = f(require("./1060.js"));
var a = f(require("./1061.js"));
var s = f(require("./1062.js"));
var l = f(require("./1063.js"));
var u = f(require("./1064.js"));
var c = f(require("./1065.js"));
var d = require("./146.js");
function f(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
d.Tools[r.SELECT_TOOL] = i.default;
d.Tools[r.PENCIL_TOOL] = o.default;
d.Tools[r.LINE_TOOL] = a.default;
d.Tools[r.ERASER_TOOL] = s.default;
d.Tools[r.PAN_TOOL] = l.default;
d.Tools[r.ZOOM_TOOL] = u.default;
d.Tools[r.ADJUST_START_TOOL] = c.default;