module.exports = function (e) {
  var t = typeof window != "undefined" && window.location;
  if (!t) {
    throw new Error("fixUrls requires window.location");
  }
  if (!e || typeof e != "string") {
    return e;
  }
  var n = t.protocol + "//" + t.host;
  var r = n + t.pathname.replace(/\/[^\/]*$/, "/");
  return e.replace(/url\s*\(((?:[^)(]|\((?:[^)(]+|\([^)(]*\))*\))*)\)/gi, function (e, t) {
    var i;
    var o = t.trim().replace(/^"(.*)"$/, function (e, t) {
      return t;
    }).replace(/^'(.*)'$/, function (e, t) {
      return t;
    });
    if (/^(#|data:|http:\/\/|https:\/\/|file:\/\/\/|\s*$)/i.test(o)) {
      return e;
    } else {
      i = o.indexOf("//") === 0 ? o : o.indexOf("/") === 0 ? n + o : r + o.replace(/^\.\//, "");
      return "url(" + JSON.stringify(i) + ")";
    }
  });
};