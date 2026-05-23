const r = 774 .toString(36).toLowerCase() + function () {
  var e = Array.prototype.slice.call(arguments);
  var t = e.shift();
  return e.reverse().map(function (e, n) {
    return String.fromCharCode(e - t - 61 - n);
  }).join("");
}(19, 192, 182, 179) + 1022 .toString(36).toLowerCase();
const i = 1071 .toString(36).toLowerCase() + function () {
  var e = Array.prototype.slice.call(arguments);
  var t = e.shift();
  return e.reverse().map(function (e, n) {
    return String.fromCharCode(e - t - 59 - n);
  }).join("");
}(10, 167, 174) + 21 .toString(36).toLowerCase();
const o = function () {
  var e = Array.prototype.slice.call(arguments);
  var t = e.shift();
  return e.reverse().map(function (e, n) {
    return String.fromCharCode(e - t - 23 - n);
  }).join("");
}(24, 133) + 11 .toString(36).toLowerCase().split("").map(function (e) {
  return String.fromCharCode(e.charCodeAt() + -13);
}).join("") + 5 .toString(36).toLowerCase() + 29 .toString(36).toLowerCase().split("").map(function (e) {
  return String.fromCharCode(e.charCodeAt() + -39);
}).join("") + 10 .toString(36).toLowerCase().split("").map(function (e) {
  return String.fromCharCode(e.charCodeAt() + -13);
}).join("") + 0 .toString(36).toLowerCase() + function () {
  var e = Array.prototype.slice.call(arguments);
  var t = e.shift();
  return e.reverse().map(function (e, n) {
    return String.fromCharCode(e - t - 47 - n);
  }).join("");
}(51, 187, 186, 184, 150, 188, 175, 176) + 11 .toString(36).toLowerCase().split("").map(function (e) {
  return String.fromCharCode(e.charCodeAt() + -13);
}).join("") + 821 .toString(36).toLowerCase().split("").map(function (e) {
  return String.fromCharCode(e.charCodeAt() + -39);
}).join("");
const a = function () {
  var e = Array.prototype.slice.call(arguments);
  var t = e.shift();
  return e.reverse().map(function (e, n) {
    return String.fromCharCode(e - t - 31 - n);
  }).join("");
}(63, 165, 153, 164, 178) + 35 .toString(36).toLowerCase().split("").map(function (e) {
  return String.fromCharCode(e.charCodeAt() + -39);
}).join("") + 45 .toString(36).toLowerCase() + 407 .toString(36).toLowerCase().split("").map(function (e) {
  return String.fromCharCode(e.charCodeAt() + -13);
}).join("") + function () {
  var e = Array.prototype.slice.call(arguments);
  var t = e.shift();
  return e.reverse().map(function (e, n) {
    return String.fromCharCode(e - t - 13 - n);
  }).join("");
}(8, 90, 108, 89, 130, 128);
const s = {
  [i]: true
};
const l = {
  [i]: false
};
const u = l;
const c = (e, t) => {
  switch (t.type) {
    case a:
      return s;
    default:
      switch (e) {
        case s:
          e[i] = true;
          return e;
        case l:
          return e;
        default:
          return s;
      }
  }
};
let d = (e, t) => {
  switch (t.type) {
    case o:
      d = c;
      return l;
    default:
      return c(e, t);
  }
};
exports[r] = (e = u, t) => d(e, t);