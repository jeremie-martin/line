Object.defineProperty(exports, "__esModule", {
  value: true
});
u(require("./40.js"));
var r = u(require("./4.js"));
var i = u(require("./6.js"));
var o = u(require("./0.js"));
u(require("./1.js"));
u(require("./14.js"));
var a = require("./122.js");
var s = require("./20.js");
var l = u(require("./2.js"));
function u(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function c(e) {
  var t = e.children;
  var n = e.classes;
  e.lgDown;
  e.lgUp;
  e.mdDown;
  e.mdUp;
  var i = e.only;
  e.smDown;
  e.smUp;
  e.xlDown;
  e.xlUp;
  e.xsDown;
  e.xsUp;
  (0, r.default)(e, ["children", "classes", "lgDown", "lgUp", "mdDown", "mdUp", "only", "smDown", "smUp", "xlDown", "xlUp", "xsDown", "xsUp"]);
  var l = [];
  for (var u = 0; u < a.keys.length; u += 1) {
    var c = a.keys[u];
    var d = e[c + "Up"];
    var f = e[c + "Down"];
    if (d) {
      l.push(n[c + "Up"]);
    }
    if (f) {
      l.push(n[c + "Down"]);
    }
  }
  if (i) {
    (Array.isArray(i) ? i : [i]).forEach(function (e) {
      l.push(n["only" + (0, s.capitalize)(e)]);
    });
  }
  return o.default.createElement("div", {
    className: l
  }, t);
}
c.propTypes = {};
exports.default = (0, l.default)(function (e) {
  var t = {
    display: "none"
  };
  return a.keys.reduce(function (n, r) {
    n["only" + (0, s.capitalize)(r)] = (0, i.default)({}, e.breakpoints.only(r), t);
    n[r + "Up"] = (0, i.default)({}, e.breakpoints.up(r), t);
    n[r + "Down"] = (0, i.default)({}, e.breakpoints.down(r), t);
    return n;
  }, {});
}, {
  name: "MuiHiddenCss"
})(c);