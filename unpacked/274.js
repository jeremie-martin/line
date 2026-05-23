var r = require("./477.js");
exports.extract = function (e) {
  return e.split("?")[1] || "";
};
exports.parse = function (e) {
  if (typeof e != "string") {
    return {};
  } else if (e = e.trim().replace(/^(\?|#|&)/, "")) {
    return e.split("&").reduce(function (e, t) {
      var n = t.replace(/\+/g, " ").split("=");
      var r = n.shift();
      var i = n.length > 0 ? n.join("=") : undefined;
      r = decodeURIComponent(r);
      i = i === undefined ? null : decodeURIComponent(i);
      if (e.hasOwnProperty(r)) {
        if (Array.isArray(e[r])) {
          e[r].push(i);
        } else {
          e[r] = [e[r], i];
        }
      } else {
        e[r] = i;
      }
      return e;
    }, {});
  } else {
    return {};
  }
};
exports.stringify = function (e) {
  if (e) {
    return Object.keys(e).sort().map(function (t) {
      var n = e[t];
      if (n === undefined) {
        return "";
      } else if (n === null) {
        return t;
      } else if (Array.isArray(n)) {
        return n.slice().sort().map(function (e) {
          return r(t) + "=" + r(e);
        }).join("&");
      } else {
        return r(t) + "=" + r(n);
      }
    }).filter(function (e) {
      return e.length > 0;
    }).join("&");
  } else {
    return "";
  }
};