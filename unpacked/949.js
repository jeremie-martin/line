module.exports = function (e, t) {
  if (typeof e != "function" || typeof t != "number") {
    throw new Error("stifle(fn, wait) -- expected a function and number of milliseconds, got (" + typeof e + ", " + typeof t + ")");
  }
  var n;
  var r;
  function i() {
    if (n) {
      r = true;
    } else {
      n = setTimeout(o, t);
      e();
    }
  }
  function o() {
    n = undefined;
    if (r) {
      r = false;
      i();
    }
  }
  i.cancel = function () {
    r = false;
    if (n) {
      clearTimeout(n);
      n = undefined;
    }
  };
  return i;
};