var r = Object.prototype.hasOwnProperty;
function i(e, t) {
  if (e === t) {
    return e !== 0 || t !== 0 || 1 / e == 1 / t;
  } else {
    return e != e && t != t;
  }
}
module.exports = function (e, t) {
  if (i(e, t)) {
    return true;
  }
  if (typeof e != "object" || e === null || typeof t != "object" || t === null) {
    return false;
  }
  var n = Object.keys(e);
  var o = Object.keys(t);
  if (n.length !== o.length) {
    return false;
  }
  for (var a = 0; a < n.length; a++) {
    if (!r.call(t, n[a]) || !i(e[n[a]], t[n[a]])) {
      return false;
    }
  }
  return true;
};