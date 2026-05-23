module.exports = function (e) {
  var t = n.call(e);
  return t === "[object Function]" || typeof e == "function" && t !== "[object RegExp]" || typeof window != "undefined" && (e === window.setTimeout || e === window.alert || e === window.confirm || e === window.prompt);
};
var n = Object.prototype.toString;