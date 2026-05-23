Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./155.js"));
var i = o(require("./40.js"));
exports.capitalize = function (e) {
  0;
  return e.charAt(0).toUpperCase() + e.slice(1);
};
exports.contains = a;
exports.findIndex = s;
exports.find = function (e, t) {
  var n = s(e, t);
  if (n > -1) {
    return e[n];
  } else {
    return undefined;
  }
};
exports.createChainedFunction = function () {
  for (var e = arguments.length, t = Array(e), n = 0; n < e; n++) {
    t[n] = arguments[n];
  }
  return t.filter(function (e) {
    return e != null;
  }).reduce(function (e, t) {
    return function () {
      for (var n = arguments.length, r = Array(n), i = 0; i < n; i++) {
        r[i] = arguments[i];
      }
      e.apply(this, r);
      t.apply(this, r);
    };
  }, function () {});
};
o(require("./14.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function a(e, t) {
  return (0, i.default)(t).every(function (n) {
    return e.hasOwnProperty(n) && e[n] === t[n];
  });
}
function s(e, t) {
  var n = t === undefined ? "undefined" : (0, r.default)(t);
  for (var i = 0; i < e.length; i += 1) {
    if (n === "function" && !!t(e[i], i, e) == true) {
      return i;
    }
    if (n === "object" && a(e[i], t)) {
      return i;
    }
    if (["string", "number", "boolean"].indexOf(n) !== -1) {
      return e.indexOf(t);
    }
  }
  return -1;
}