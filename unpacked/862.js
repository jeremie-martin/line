Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.animationEnd = exports.animationDelay = exports.animationTiming = exports.animationDuration = exports.animationName = exports.transitionEnd = exports.transitionDuration = exports.transitionDelay = exports.transitionTiming = exports.transitionProperty = exports.transform = undefined;
var r;
var i = require("./166.js");
var o = "transform";
var a = undefined;
var s = undefined;
var l = undefined;
var u = undefined;
var c = undefined;
var d = undefined;
var f = undefined;
var p = undefined;
var h = undefined;
var m = undefined;
var y = undefined;
if (((r = i) && r.__esModule ? r : {
  default: r
}).default) {
  var g = function () {
    var e = document.createElement("div").style;
    var t = {
      O: function (e) {
        return "o" + e.toLowerCase();
      },
      Moz: function (e) {
        return e.toLowerCase();
      },
      Webkit: function (e) {
        return "webkit" + e;
      },
      ms: function (e) {
        return "MS" + e;
      }
    };
    for (var n = Object.keys(t), r = undefined, i = undefined, o = "", a = 0; a < n.length; a++) {
      var s = n[a];
      if (s + "TransitionProperty" in e) {
        o = "-" + s.toLowerCase();
        r = t[s]("TransitionEnd");
        i = t[s]("AnimationEnd");
        break;
      }
    }
    if (!r && "transitionProperty" in e) {
      r = "transitionend";
    }
    if (!i && "animationName" in e) {
      i = "animationend";
    }
    e = null;
    return {
      animationEnd: i,
      transitionEnd: r,
      prefix: o
    };
  }();
  a = g.prefix;
  exports.transitionEnd = s = g.transitionEnd;
  exports.animationEnd = l = g.animationEnd;
  exports.transform = o = a + "-" + o;
  exports.transitionProperty = u = a + "-transition-property";
  exports.transitionDuration = c = a + "-transition-duration";
  exports.transitionDelay = f = a + "-transition-delay";
  exports.transitionTiming = d = a + "-transition-timing-function";
  exports.animationName = p = a + "-animation-name";
  exports.animationDuration = h = a + "-animation-duration";
  exports.animationTiming = m = a + "-animation-delay";
  exports.animationDelay = y = a + "-animation-timing-function";
}
exports.transform = o;
exports.transitionProperty = u;
exports.transitionTiming = d;
exports.transitionDelay = f;
exports.transitionDuration = c;
exports.transitionEnd = s;
exports.animationName = p;
exports.animationDuration = h;
exports.animationTiming = m;
exports.animationDelay = y;
exports.animationEnd = l;
exports.default = {
  transform: o,
  end: s,
  property: u,
  timing: d,
  delay: f,
  duration: c
};