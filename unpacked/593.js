exports.parse = function (e, t) {
  if (typeof e != "string") {
    throw new TypeError("argument str must be a string");
  }
  var n = {};
  var i = t || {};
  for (var a = e.split(o), l = i.decode || r, u = 0; u < a.length; u++) {
    var c = a[u];
    var d = c.indexOf("=");
    if (!(d < 0)) {
      var f = c.substr(0, d).trim();
      var p = c.substr(++d, c.length).trim();
      if (p[0] == "\"") {
        p = p.slice(1, -1);
      }
      if (n[f] == undefined) {
        n[f] = s(p, l);
      }
    }
  }
  return n;
};
exports.serialize = function (e, t, n) {
  var r = n || {};
  var o = r.encode || i;
  if (typeof o != "function") {
    throw new TypeError("option encode is invalid");
  }
  if (!a.test(e)) {
    throw new TypeError("argument name is invalid");
  }
  var s = o(t);
  if (s && !a.test(s)) {
    throw new TypeError("argument val is invalid");
  }
  var l = e + "=" + s;
  if (r.maxAge != null) {
    var u = r.maxAge - 0;
    if (isNaN(u)) {
      throw new Error("maxAge should be a Number");
    }
    l += "; Max-Age=" + Math.floor(u);
  }
  if (r.domain) {
    if (!a.test(r.domain)) {
      throw new TypeError("option domain is invalid");
    }
    l += "; Domain=" + r.domain;
  }
  if (r.path) {
    if (!a.test(r.path)) {
      throw new TypeError("option path is invalid");
    }
    l += "; Path=" + r.path;
  }
  if (r.expires) {
    if (typeof r.expires.toUTCString != "function") {
      throw new TypeError("option expires is invalid");
    }
    l += "; Expires=" + r.expires.toUTCString();
  }
  if (r.httpOnly) {
    l += "; HttpOnly";
  }
  if (r.secure) {
    l += "; Secure";
  }
  if (r.sameSite) {
    var c = typeof r.sameSite == "string" ? r.sameSite.toLowerCase() : r.sameSite;
    switch (c) {
      case true:
        l += "; SameSite=Strict";
        break;
      case "lax":
        l += "; SameSite=Lax";
        break;
      case "strict":
        l += "; SameSite=Strict";
        break;
      default:
        throw new TypeError("option sameSite is invalid");
    }
  }
  return l;
};
var r = decodeURIComponent;
var i = encodeURIComponent;
var o = /; */;
var a = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
function s(e, t) {
  try {
    return t(e);
  } catch (t) {
    return e;
  }
}