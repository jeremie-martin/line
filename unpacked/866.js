Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ariaHidden = o;
exports.hideSiblings = function (e, t) {
  i(e, t, function (e) {
    return o(true, e);
  });
};
exports.showSiblings = function (e, t) {
  i(e, t, function (e) {
    return o(false, e);
  });
};
var r = ["template", "script", "style"];
function i(e, t, n) {
  t = [].concat(t);
  [].forEach.call(e.children, function (e) {
    if (t.indexOf(e) === -1 && function (e) {
      return e.nodeType === 1 && r.indexOf(e.tagName.toLowerCase()) === -1;
    }(e)) {
      n(e);
    }
  });
}
function o(e, t) {
  if (t) {
    if (e) {
      t.setAttribute("aria-hidden", "true");
    } else {
      t.removeAttribute("aria-hidden");
    }
  }
}