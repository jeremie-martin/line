var n = 9;
if (typeof Element != "undefined" && !Element.prototype.matches) {
  var r = Element.prototype;
  r.matches = r.matchesSelector || r.mozMatchesSelector || r.msMatchesSelector || r.oMatchesSelector || r.webkitMatchesSelector;
}
module.exports = function (e, t) {
  while (e && e.nodeType !== n) {
    if (typeof e.matches == "function" && e.matches(t)) {
      return e;
    }
    e = e.parentNode;
  }
};