var r = require("./1027.js");
function i(e, t, n, i, o) {
  var a = function (e, t, n, i) {
    return function (n) {
      n.delegateTarget = r(n.target, t);
      if (n.delegateTarget) {
        i.call(e, n);
      }
    };
  }.apply(this, arguments);
  e.addEventListener(n, a, o);
  return {
    destroy: function () {
      e.removeEventListener(n, a, o);
    }
  };
}
module.exports = function (e, t, n, r, o) {
  if (typeof e.addEventListener == "function") {
    return i.apply(null, arguments);
  } else if (typeof n == "function") {
    return i.bind(null, document).apply(null, arguments);
  } else {
    if (typeof e == "string") {
      e = document.querySelectorAll(e);
    }
    return Array.prototype.map.call(e, function (e) {
      return i(e, t, n, r, o);
    });
  }
};