var r = require("./487.js");
module.exports = function e(t, n) {
  return !!t && !!n && (t === n || !r(t) && (r(n) ? e(t, n.parentNode) : "contains" in t ? t.contains(n) : !!t.compareDocumentPosition && !!(t.compareDocumentPosition(n) & 16)));
};