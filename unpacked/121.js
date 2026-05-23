var r = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function (e) {
  return typeof e;
} : function (e) {
  if (e && typeof Symbol == "function" && e.constructor === Symbol && e !== Symbol.prototype) {
    return "symbol";
  } else {
    return typeof e;
  }
};
export var isBrowser = (typeof window == "undefined" ? "undefined" : r(window)) === "object" && (typeof document == "undefined" ? "undefined" : r(document)) === "object" && document.nodeType === 9;
exports.default = isBrowser;