Object.defineProperty(exports, "__esModule", {
  value: true
});
l(require("./908.js"));
l(require("./40.js"));
var r = l(require("./4.js"));
var i = l(require("./1.js"));
l(require("./14.js"));
var o = require("./122.js");
var a = require("./172.js");
var s = l(a);
function l(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function u(e) {
  var t = e.children;
  e.lgDown;
  e.lgUp;
  e.mdDown;
  e.mdUp;
  var n = e.only;
  e.smDown;
  e.smUp;
  var i = e.width;
  e.xlDown;
  e.xlUp;
  e.xsDown;
  e.xsUp;
  (0, r.default)(e, ["children", "lgDown", "lgUp", "mdDown", "mdUp", "only", "smDown", "smUp", "width", "xlDown", "xlUp", "xsDown", "xsUp"]);
  var s = true;
  if (n) {
    if (Array.isArray(n)) {
      for (var l = 0; l < n.length; l += 1) {
        if (i === n[l]) {
          s = false;
          break;
        }
      }
    } else if (n && i === n) {
      s = false;
    }
  }
  if (s) {
    for (var u = 0; u < o.keys.length; u += 1) {
      var c = o.keys[u];
      var d = e[c + "Up"];
      var f = e[c + "Down"];
      if (d && (0, a.isWidthUp)(c, i) || f && (0, a.isWidthDown)(c, i)) {
        s = false;
        break;
      }
    }
  }
  if (s) {
    return t;
  } else {
    return null;
  }
}
u.propTypes = {
  children: i.default.node,
  className: i.default.string,
  implementation: i.default.oneOf(["js", "css"]),
  initialWidth: i.default.oneOf(["xs", "sm", "md", "lg", "xl"]),
  lgDown: i.default.bool,
  lgUp: i.default.bool,
  mdDown: i.default.bool,
  mdUp: i.default.bool,
  only: i.default.oneOfType([i.default.oneOf(["xs", "sm", "md", "lg", "xl"]), i.default.arrayOf(i.default.oneOf(["xs", "sm", "md", "lg", "xl"]))]),
  smDown: i.default.bool,
  smUp: i.default.bool,
  width: i.default.string.isRequired,
  xlDown: i.default.bool,
  xlUp: i.default.bool,
  xsDown: i.default.bool,
  xsUp: i.default.bool
};
exports.default = (0, s.default)()(u);