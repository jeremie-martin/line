module.exports = function (e) {
  var t = (e ? e.ownerDocument || e : document).defaultView || window;
  return !!e && !!(typeof t.Node == "function" ? e instanceof t.Node : typeof e == "object" && typeof e.nodeType == "number" && typeof e.nodeName == "string");
};