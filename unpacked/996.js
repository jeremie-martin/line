var r = /[A-Z]/g;
var i = /^ms-/;
var o = {};
module.exports = function (e) {
  if (e in o) {
    return o[e];
  } else {
    return o[e] = e.replace(r, "-$&").toLowerCase().replace(i, "-ms-");
  }
};