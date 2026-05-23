var r = {
  childContextTypes: true,
  contextTypes: true,
  defaultProps: true,
  displayName: true,
  getDefaultProps: true,
  mixins: true,
  propTypes: true,
  type: true
};
var i = {
  name: true,
  length: true,
  prototype: true,
  caller: true,
  callee: true,
  arguments: true,
  arity: true
};
var o = Object.defineProperty;
var a = Object.getOwnPropertyNames;
var s = Object.getOwnPropertySymbols;
var l = Object.getOwnPropertyDescriptor;
var u = Object.getPrototypeOf;
var c = u && u(Object);
module.exports = function e(t, n, d) {
  if (typeof n != "string") {
    if (c) {
      var f = u(n);
      if (f && f !== c) {
        e(t, f, d);
      }
    }
    var p = a(n);
    if (s) {
      p = p.concat(s(n));
    }
    for (var h = 0; h < p.length; ++h) {
      var m = p[h];
      if (!r[m] && !i[m] && (!d || !d[m])) {
        var y = l(n, m);
        try {
          o(t, m, y);
        } catch (e) {}
      }
    }
    return t;
  }
  return t;
};