Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = typeof window != "undefined" && !!window.document && !!window.document.createElement;
function o() {
  if (r) {
    return r;
  }
  if (!i || !window.document.body) {
    return "indeterminate";
  }
  var e = window.document.createElement("div");
  e.appendChild(document.createTextNode("ABCD"));
  e.dir = "rtl";
  e.style.fontSize = "14px";
  e.style.width = "4px";
  e.style.height = "1px";
  e.style.position = "absolute";
  e.style.top = "-1000px";
  e.style.overflow = "scroll";
  document.body.appendChild(e);
  r = "reverse";
  if (e.scrollLeft > 0) {
    r = "default";
  } else {
    e.scrollLeft = 1;
    if (e.scrollLeft === 0) {
      r = "negative";
    }
  }
  document.body.removeChild(e);
  return r;
}
exports._setScrollType = function (e) {
  r = e;
};
exports.detectScrollType = o;
exports.getNormalizedScrollLeft = function (e, t) {
  var n = e.scrollLeft;
  if (t !== "rtl") {
    return n;
  }
  var r = o();
  if (r === "indeterminate") {
    return Number.NaN;
  }
  switch (r) {
    case "negative":
      return e.scrollWidth - e.clientWidth + n;
    case "reverse":
      return e.scrollWidth - e.clientWidth - n;
  }
  return n;
};
exports.setNormalizedScrollLeft = function (e, t, n) {
  if (n === "rtl") {
    var r = o();
    if (r !== "indeterminate") {
      switch (r) {
        case "negative":
          e.scrollLeft = e.clientWidth - e.scrollWidth + t;
          break;
        case "reverse":
          e.scrollLeft = e.scrollWidth - e.clientWidth - t;
          break;
        default:
          e.scrollLeft = t;
      }
    }
  } else {
    e.scrollLeft = t;
  }
};