Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, t) {
  if (!s) {
    return t;
  }
  if (typeof t != "string" || !isNaN(parseInt(t, 10))) {
    return t;
  }
  var n = e + t;
  if (a[n] != null) {
    return a[n];
  }
  try {
    s.style[e] = t;
  } catch (e) {
    a[n] = false;
    return false;
  }
  if (s.style[e] !== "") {
    a[n] = t;
  } else {
    if ((t = i.default.css + t) === "-ms-flex") {
      t = "-ms-flexbox";
    }
    s.style[e] = t;
    if (s.style[e] !== "") {
      a[n] = t;
    }
  }
  a[n] ||= false;
  s.style[e] = "";
  return a[n];
};
var r = o(require("./121.js"));
var i = o(require("./234.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var a = {};
var s = undefined;
if (r.default) {
  s = document.createElement("p");
}