var r = require("./1025.js");
var i = require("./1026.js");
module.exports = function (e, t, n) {
  if (!e && !t && !n) {
    throw new Error("Missing required arguments");
  }
  if (!r.string(t)) {
    throw new TypeError("Second argument must be a String");
  }
  if (!r.fn(n)) {
    throw new TypeError("Third argument must be a Function");
  }
  if (r.node(e)) {
    return function (e, t, n) {
      e.addEventListener(t, n);
      return {
        destroy: function () {
          e.removeEventListener(t, n);
        }
      };
    }(e, t, n);
  }
  if (r.nodeList(e)) {
    return function (e, t, n) {
      Array.prototype.forEach.call(e, function (e) {
        e.addEventListener(t, n);
      });
      return {
        destroy: function () {
          Array.prototype.forEach.call(e, function (e) {
            e.removeEventListener(t, n);
          });
        }
      };
    }(e, t, n);
  }
  if (r.string(e)) {
    return function (e, t, n) {
      return i(document.body, e, t, n);
    }(e, t, n);
  }
  throw new TypeError("First argument must be a String, HTMLElement, HTMLCollection, or NodeList");
};