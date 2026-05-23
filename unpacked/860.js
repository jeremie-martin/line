Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e) {
  if (!e) {
    throw new TypeError("No Element passed to `getComputedStyle()`");
  }
  var t = e.ownerDocument;
  if ("defaultView" in t) {
    if (t.defaultView.opener) {
      return e.ownerDocument.defaultView.getComputedStyle(e, null);
    } else {
      return window.getComputedStyle(e, null);
    }
  } else {
    return {
      getPropertyValue: function (t) {
        var n = e.style;
        if ((t = (0, o.default)(t)) == "float") {
          t = "styleFloat";
        }
        var r = e.currentStyle[t] || null;
        if (r == null && n && n[t]) {
          r = n[t];
        }
        if (s.test(r) && !a.test(t)) {
          var i = n.left;
          var l = e.runtimeStyle;
          var u = l && l.left;
          if (u) {
            l.left = e.currentStyle.left;
          }
          n.left = t === "fontSize" ? "1em" : r;
          r = n.pixelLeft + "px";
          n.left = i;
          if (u) {
            l.left = u;
          }
        }
        return r;
      }
    };
  }
};
var r;
var i = require("./380.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
var a = /^(top|right|bottom|left)$/;
var s = /^([+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|))(?!px)[a-z%]+$/i;
module.exports = exports.default;