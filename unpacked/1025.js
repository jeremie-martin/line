exports.node = function (e) {
  return e !== undefined && e instanceof HTMLElement && e.nodeType === 1;
};
exports.nodeList = function (e) {
  var n = Object.prototype.toString.call(e);
  return e !== undefined && (n === "[object NodeList]" || n === "[object HTMLCollection]") && "length" in e && (e.length === 0 || exports.node(e[0]));
};
exports.string = function (e) {
  return typeof e == "string" || e instanceof String;
};
exports.fn = function (e) {
  return Object.prototype.toString.call(e) === "[object Function]";
};